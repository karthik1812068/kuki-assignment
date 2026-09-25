import { dirname, join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPostgresPool } from './postgres';

export async function runMigrations(connectionString: string): Promise<void> {
  const pool = createPostgresPool(connectionString);
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: join(dirname(__dirname), 'migrations'),
    });
  } finally {
    await pool.end();
  }
}
