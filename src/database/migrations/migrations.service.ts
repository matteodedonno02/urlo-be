import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createConnection, type Connection } from 'mysql2/promise';
import { DbConfig } from '../../models/db-config';
import { ensureDatabaseExists } from '../ensure-database-exists';

@Injectable()
export class MigrationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationsService.name);

  constructor(private readonly configService: ConfigService) {}

  async onApplicationBootstrap(): Promise<void> {
    const appDb = this.configService.get<DbConfig>('database');
    const migDb = this.configService.get<DbConfig>('migrationDatabase');
    const alwaysRebuild =
      this.configService.get<boolean>('database.alwaysRebuild') ?? false;

    if (!migDb?.host || !migDb?.name) {
      this.logger.warn(
        'migrationDatabase not configured, skipping migrations.',
      );
      return;
    }
    if (!appDb?.host || !appDb?.name) {
      this.logger.warn('database not configured, skipping migrations.');
      return;
    }

    await ensureDatabaseExists(migDb);
    await ensureDatabaseExists(appDb);

    const appConn = await createConnection(this.dbOptions(appDb));
    const migConn = await createConnection(this.dbOptions(migDb));

    try {
      await migConn.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename VARCHAR(255) NOT NULL PRIMARY KEY,
          hash CHAR(64) NOT NULL,
          executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);

      if (alwaysRebuild) {
        await this.destroyAppDb(appConn, appDb);
        await migConn.query('DELETE FROM schema_migrations');
        this.logger.log(
          'alwaysRebuild enabled: dropped all app tables and reset migration history.',
        );
      }

      const dir = join(process.cwd(), 'migrations');
      const files = readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const sql = readFileSync(join(dir, file), 'utf8').replace(
          /\r\n/g,
          '\n',
        );
        const hash = createHash('sha256').update(sql).digest('hex');
        const downSql = this.loadDownMigration(file);

        const [rows] = await migConn.query(
          'SELECT hash FROM schema_migrations WHERE filename = ?',
          [file],
        );
        const existing = (rows as Array<{ hash: string }>)[0];

        if (existing) {
          if (existing.hash !== hash) {
            throw new Error(
              `Migration "${file}" hash mismatch: registered "${existing.hash}" but file is "${hash}"`,
            );
          }
          this.logger.log(`Migration "${file}" already executed, skipping.`);
          continue;
        }

        await appConn.beginTransaction();
        try {
          await appConn.query(sql);
          await appConn.commit();
        } catch (err) {
          await appConn.rollback();
          await this.tryRollback(appConn, file, downSql);
          throw err;
        }

        await migConn.query(
          'INSERT INTO schema_migrations (filename, hash) VALUES (?, ?)',
          [file, hash],
        );
        this.logger.log(`Migration "${file}" applied.`);
      }
    } finally {
      await appConn.end();
      await migConn.end();
    }
  }

  private loadDownMigration(file: string): string | null {
    const downPath = join(process.cwd(), 'migrations', 'down', file);
    try {
      const sql = readFileSync(downPath, 'utf8').replace(/\r\n/g, '\n').trim();
      return sql.length > 0 ? sql : null;
    } catch {
      return null;
    }
  }

  private async tryRollback(
    appConn: Connection,
    file: string,
    downSql: string | null,
  ): Promise<void> {
    if (!downSql) {
      return;
    }
    try {
      await appConn.query(downSql);
      this.logger.log(`Migration "${file}" failed; rolled back via down SQL.`);
    } catch (err) {
      this.logger.error(
        `Migration "${file}" failed and its down SQL could not be applied: ${(err as Error).message}`,
      );
    }
  }

  private async destroyAppDb(
    appConn: Connection,
    appDb: DbConfig,
  ): Promise<void> {
    const [rows] = await appConn.query(
      'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [appDb.name],
    );
    const tables = (rows as Array<{ name: string }>).map((r) => r.name);

    if (tables.length === 0) {
      return;
    }

    const dropStmt = `SET FOREIGN_KEY_CHECKS = 0; ${tables
      .map((t) => `DROP TABLE IF EXISTS \`${t}\``)
      .join('; ')}; SET FOREIGN_KEY_CHECKS = 1;`;
    await appConn.query(dropStmt);
  }

  private dbOptions(db: DbConfig): Record<string, unknown> {
    return {
      host: db.host,
      port: db.port,
      user: db.username,
      password: db.password,
      database: db.name,
      multipleStatements: true,
    };
  }
}
