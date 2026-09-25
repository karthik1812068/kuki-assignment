import { Pool, type PoolConfig } from 'pg';

export function createPostgresPool(connectionString: string, overrides: PoolConfig = {}): Pool {
  return new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    ...overrides,
  });
}

export async function pingPostgres(pool: Pool): Promise<void> {
  await pool.query('SELECT 1');
}
