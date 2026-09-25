import { describe, expect, it } from 'vitest';
import {
  closeRedis,
  createPostgresPool,
  createRedisClient,
  pingPostgres,
  pingRedis,
  runMigrations,
} from '@codepilot/database';

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

describe.skipIf(!databaseUrl || !redisUrl)('local infrastructure', () => {
  const postgresUrl = databaseUrl ?? '';
  const cacheUrl = redisUrl ?? '';

  it('applies the foundation migration and answers postgres', async () => {
    await runMigrations(postgresUrl);
    const pool = createPostgresPool(postgresUrl);
    try {
      await pingPostgres(pool);
      const applied = await pool.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM drizzle."__drizzle_migrations"',
      );
      const count = applied.rows[0]?.count ?? 0;
      expect(count).toBeGreaterThan(0);
    } finally {
      await pool.end();
    }
  });

  it('answers redis', async () => {
    const client = createRedisClient(cacheUrl);
    try {
      await expect(pingRedis(client)).resolves.toBeUndefined();
    } finally {
      await closeRedis(client);
    }
  });
});
