import { DOCUMENT_DEAD_KEY, DOCUMENT_PROCESSING_KEY, DOCUMENT_QUEUE_KEY } from './document-queue';
import { INDEX_QUEUE_KEY } from './index-queue';
import { TASK_QUEUE_KEY } from './task-queue';

export const INDEX_PROCESSING_KEY = 'codepilot:index-processing';
export const INDEX_DEAD_KEY = 'codepilot:index-dead';
export const TASK_PROCESSING_KEY = 'codepilot:task-processing';
export const TASK_DEAD_KEY = 'codepilot:task-dead';
export const WORKER_HEARTBEAT_KEY = 'codepilot:worker-heartbeat';
export const WORK_ATTEMPT_LIMIT = 3;
export const WORKER_HEARTBEAT_TTL_SECONDS = 45;

export interface WorkRedis {
  brpoplpush(source: string, destination: string, timeout: number): Promise<string | null>;
  rpoplpush(source: string, destination: string): Promise<string | null>;
  lrem(key: string, count: number, value: string): Promise<number>;
  lpush(key: string, value: string): Promise<number>;
  llen(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
}

export interface QueueCounts {
  waiting: number;
  processing: number;
  dead: number;
}

export interface WorkSnapshot {
  index: QueueCounts;
  task: QueueCounts;
  documents: QueueCounts;
  workerSeenAt: string | null;
  workerLive: boolean;
}

export async function takeWork(
  client: WorkRedis,
  waitingKey: string,
  processingKey: string,
  timeoutSeconds: number,
): Promise<string | null> {
  return client.brpoplpush(waitingKey, processingKey, timeoutSeconds);
}

export async function ackWork(
  client: WorkRedis,
  processingKey: string,
  raw: string,
): Promise<void> {
  await client.lrem(processingKey, 1, raw);
}

export async function failWork(
  client: WorkRedis,
  processingKey: string,
  waitingKey: string,
  deadKey: string,
  raw: string,
  attemptLimit = WORK_ATTEMPT_LIMIT,
): Promise<'retried' | 'dead'> {
  await client.lrem(processingKey, 1, raw);
  const next = bumpAttempt(raw);
  if (!next || next.attempt >= attemptLimit) {
    await client.lpush(deadKey, next?.payload ?? raw);
    return 'dead';
  }
  await client.lpush(waitingKey, next.payload);
  return 'retried';
}

export async function reclaimProcessing(
  client: WorkRedis,
  processingKey: string,
  waitingKey: string,
): Promise<number> {
  let moved = 0;
  for (;;) {
    const raw = await client.rpoplpush(processingKey, waitingKey);
    if (!raw) {
      return moved;
    }
    moved += 1;
  }
}

export async function touchWorkerHeartbeat(client: WorkRedis, now = new Date()): Promise<void> {
  await client.setex(WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_TTL_SECONDS, now.toISOString());
}

export async function readWorkSnapshot(client: WorkRedis, now = new Date()): Promise<WorkSnapshot> {
  const [
    indexWaiting,
    indexProcessing,
    indexDead,
    taskWaiting,
    taskProcessing,
    taskDead,
    documentWaiting,
    documentProcessing,
    documentDead,
    seen,
  ] = await Promise.all([
    client.llen(INDEX_QUEUE_KEY),
    client.llen(INDEX_PROCESSING_KEY),
    client.llen(INDEX_DEAD_KEY),
    client.llen(TASK_QUEUE_KEY),
    client.llen(TASK_PROCESSING_KEY),
    client.llen(TASK_DEAD_KEY),
    client.llen(DOCUMENT_QUEUE_KEY),
    client.llen(DOCUMENT_PROCESSING_KEY),
    client.llen(DOCUMENT_DEAD_KEY),
    client.get(WORKER_HEARTBEAT_KEY),
  ]);
  const workerSeenAt = seen && Number.isFinite(Date.parse(seen)) ? seen : null;
  return {
    index: { waiting: indexWaiting, processing: indexProcessing, dead: indexDead },
    task: { waiting: taskWaiting, processing: taskProcessing, dead: taskDead },
    documents: {
      waiting: documentWaiting,
      processing: documentProcessing,
      dead: documentDead,
    },
    workerSeenAt,
    workerLive: isWorkerLive(workerSeenAt, now),
  };
}

export function bumpAttempt(raw: string): { payload: string; attempt: number } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const previous =
    typeof record.attempt === 'number' && Number.isInteger(record.attempt) ? record.attempt : 0;
  const attempt = previous + 1;
  return { payload: JSON.stringify({ ...record, attempt }), attempt };
}

function isWorkerLive(seenAt: string | null, now: Date): boolean {
  if (!seenAt) {
    return false;
  }
  const seen = Date.parse(seenAt);
  if (!Number.isFinite(seen)) {
    return false;
  }
  return now.getTime() - seen <= WORKER_HEARTBEAT_TTL_SECONDS * 1_000;
}
