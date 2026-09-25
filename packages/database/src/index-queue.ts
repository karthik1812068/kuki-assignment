import type { IndexJob } from '@codepilot/types';
import type { Redis } from 'ioredis';

export const INDEX_QUEUE_KEY = 'codepilot:index-queue';

const RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseIndexJob(raw: string): IndexJob | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.repositoryId !== 'string' || typeof record.ownerId !== 'string') {
    return null;
  }
  if (!RESOURCE_ID.test(record.repositoryId) || !RESOURCE_ID.test(record.ownerId)) {
    return null;
  }
  return { repositoryId: record.repositoryId, ownerId: record.ownerId };
}

export async function enqueueIndexJob(client: Redis, job: IndexJob): Promise<void> {
  const payload = parseIndexJob(JSON.stringify(job));
  if (!payload) {
    throw new Error('Invalid index job.');
  }
  if (client.status === 'wait' || client.status === 'end') {
    await client.connect();
  }
  await client.lpush(INDEX_QUEUE_KEY, JSON.stringify(payload));
}
