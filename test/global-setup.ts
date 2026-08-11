import { readFileSync } from 'fs';
import { join } from 'path';
import { createConnection } from 'mysql2/promise';

export default async (): Promise<void> => {
  process.env.NODE_ENV = 'test';
  const config = JSON.parse(
    readFileSync(join(process.cwd(), 'config.test.json'), 'utf8'),
  ) as {
    database: {
      host: string;
      port: number;
      username?: string;
      password?: string;
      name?: string;
    };
    migrationDatabase: {
      host: string;
      port: number;
      username?: string;
      password?: string;
      name?: string;
    };
  };

  for (const db of [config.database, config.migrationDatabase]) {
    if (!db.host || !db.name) {
      continue;
    }
    const conn = await createConnection({
      host: db.host,
      port: db.port,
      user: db.username,
      password: db.password,
    });
    try {
      await conn.query(
        `CREATE DATABASE IF NOT EXISTS \`${db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    } finally {
      await conn.end();
    }
  }
};
