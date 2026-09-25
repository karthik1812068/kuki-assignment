import { Redis } from 'ioredis';

export function createBlockingRedisClient(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: null,
    connectTimeout: 5_000,
    retryStrategy: (times) => (times > 20 ? null : Math.min(times * 200, 2_000)),
  });
}

export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    retryStrategy: (times) => Math.min(times * 200, 2_000),
  });
}

export async function pingRedis(client: Redis): Promise<void> {
  if (client.status === 'wait' || client.status === 'end') {
    await client.connect();
  }

  const result = await client.ping();
  if (result !== 'PONG') {
    throw new Error('Redis did not respond to ping.');
  }
}

export async function closeRedis(client: Redis): Promise<void> {
  if (client.status === 'wait' || client.status === 'end') {
    client.disconnect();
    return;
  }

  await client.quit();
}
