import type { Redis } from 'ioredis';

export const TASK_QUEUE_KEY = 'codepilot:task-queue';

const RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TaskJob {
  taskId: string;
  ownerId: string;
}

export function parseTaskJob(raw: string): TaskJob | null {
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
  if (typeof record.taskId !== 'string' || typeof record.ownerId !== 'string') {
    return null;
  }
  if (!RESOURCE_ID.test(record.taskId) || !RESOURCE_ID.test(record.ownerId)) {
    return null;
  }
  return { taskId: record.taskId, ownerId: record.ownerId };
}

export async function enqueueTaskJob(client: Redis, job: TaskJob): Promise<void> {
  const payload = parseTaskJob(JSON.stringify(job));
  if (!payload) {
    throw new Error('Invalid task job.');
  }
  if (client.status === 'wait' || client.status === 'end') {
    await client.connect();
  }
  await client.lpush(TASK_QUEUE_KEY, JSON.stringify(payload));
}
