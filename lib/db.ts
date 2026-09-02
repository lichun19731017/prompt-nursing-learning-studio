import { env } from 'cloudflare:workers';
export function getDb(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error('Database is unavailable');
  return db;
}
