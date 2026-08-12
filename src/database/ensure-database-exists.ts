import { createConnection } from 'mysql2/promise';
import { DbConfig } from '../models/db-config';

export async function ensureDatabaseExists(db: DbConfig): Promise<void> {
  if (!db?.host || !db?.name) {
    return;
  }

  const serverConn = await createConnection({
    host: db.host,
    port: db.port,
    user: db.username,
    password: db.password,
  });

  try {
    await serverConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await serverConn.end();
  }
}
