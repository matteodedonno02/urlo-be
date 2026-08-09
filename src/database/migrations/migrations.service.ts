import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createConnection } from 'mysql2/promise';

interface DbConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  name?: string;
}

@Injectable()
export class MigrationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationsService.name);

  constructor(private readonly configService: ConfigService) {}

  async onApplicationBootstrap(): Promise<void> {
    const appDb = this.configService.get<DbConfig>('database');
    const migDb = this.configService.get<DbConfig>('migrationDatabase');

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

      const dir = join(process.cwd(), 'migrations');
      const files = readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const sql = readFileSync(join(dir, file), 'utf8');
        const hash = createHash('sha256').update(sql).digest('hex');

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

        await appConn.query(sql);
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
