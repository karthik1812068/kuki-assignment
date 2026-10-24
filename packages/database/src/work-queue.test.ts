import { describe, expect, it } from 'vitest';
import { INDEX_QUEUE_KEY } from './index-queue';
import { TASK_QUEUE_KEY } from './task-queue';
import {
  INDEX_DEAD_KEY,
  INDEX_PROCESSING_KEY,
  TASK_DEAD_KEY,
  TASK_PROCESSING_KEY,
  ackWork,
  bumpAttempt,
  failWork,
  readWorkSnapshot,
  reclaimProcessing,
  takeWork,
  touchWorkerHeartbeat,
} from './work-queue';

class MemoryRedis {
  readonly lists = new Map<string, string[]>();
  readonly strings = new Map<string, string>();

  brpoplpush(source: string, destination: string, timeout: number): Promise<string | null> {
    void timeout;
    return this.rpoplpush(source, destination);
  }

  rpoplpush(source: string, destination: string): Promise<string | null> {
    const from = this.list(source);
    const value = from.pop();
    if (value === undefined) {
      return Promise.resolve(null);
    }
    this.list(destination).unshift(value);
    return Promise.resolve(value);
  }

  lrem(key: string, count: number, value: string): Promise<number> {
    const items = this.list(key);
    let removed = 0;
    for (let index = items.length - 1; index >= 0 && removed < count; index -= 1) {
      if (items[index] === value) {
        items.splice(index, 1);
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  lpush(key: string, value: string): Promise<number> {
    this.list(key).unshift(value);
    return Promise.resolve(this.list(key).length);
  }

  llen(key: string): Promise<number> {
    return Promise.resolve(this.list(key).length);
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.strings.get(key) ?? null);
  }

  setex(key: string, seconds: number, value: string): Promise<string> {
    void seconds;
    this.strings.set(key, value);
    return Promise.resolve('OK');
  }

  private list(key: string): string[] {
    const existing = this.lists.get(key);
    if (existing) {
      return existing;
    }
    const created: string[] = [];
    this.lists.set(key, created);
    return created;
  }
}

describe('work queue', () => {
  it('moves a job to processing and removes it on ack', async () => {
    const redis = new MemoryRedis();
    const job = '{"taskId":"a"}';
    await redis.lpush(TASK_QUEUE_KEY, job);
    const taken = await takeWork(redis, TASK_QUEUE_KEY, TASK_PROCESSING_KEY, 1);
    expect(taken).toBe(job);
    expect(await redis.llen(TASK_QUEUE_KEY)).toBe(0);
    expect(await redis.llen(TASK_PROCESSING_KEY)).toBe(1);
    await ackWork(redis, TASK_PROCESSING_KEY, job);
    expect(await redis.llen(TASK_PROCESSING_KEY)).toBe(0);
  });

  it('retries then dead-letters after the attempt limit', async () => {
    const redis = new MemoryRedis();
    const first = '{"taskId":"a"}';
    await redis.lpush(TASK_PROCESSING_KEY, first);
    expect(
      await failWork(redis, TASK_PROCESSING_KEY, TASK_QUEUE_KEY, TASK_DEAD_KEY, first, 2),
    ).toBe('retried');
    const retried = await takeWork(redis, TASK_QUEUE_KEY, TASK_PROCESSING_KEY, 1);
    expect(retried).toBe('{"taskId":"a","attempt":1}');
    expect(
      await failWork(redis, TASK_PROCESSING_KEY, TASK_QUEUE_KEY, TASK_DEAD_KEY, retried ?? '', 2),
    ).toBe('dead');
    expect(await redis.llen(TASK_DEAD_KEY)).toBe(1);
    expect(await redis.llen(TASK_QUEUE_KEY)).toBe(0);
  });

  it('reclaims processing jobs after a worker crash', async () => {
    const redis = new MemoryRedis();
    await redis.lpush(INDEX_PROCESSING_KEY, '{"repositoryId":"a"}');
    const moved = await reclaimProcessing(redis, INDEX_PROCESSING_KEY, INDEX_QUEUE_KEY);
    expect(moved).toBe(1);
    expect(await redis.llen(INDEX_QUEUE_KEY)).toBe(1);
    expect(await redis.llen(INDEX_PROCESSING_KEY)).toBe(0);
  });

  it('reports a live worker from the heartbeat', async () => {
    const redis = new MemoryRedis();
    const now = new Date('2026-10-24T04:00:00.000Z');
    await touchWorkerHeartbeat(redis, now);
    const snapshot = await readWorkSnapshot(redis, now);
    expect(snapshot.workerLive).toBe(true);
    expect(snapshot.workerSeenAt).toBe(now.toISOString());
    expect(snapshot.task.dead).toBe(0);
    expect(INDEX_DEAD_KEY).toContain('index-dead');
  });

  it('bumps attempt on a JSON payload', () => {
    expect(bumpAttempt('{"ownerId":"x"}')).toEqual({
      payload: '{"ownerId":"x","attempt":1}',
      attempt: 1,
    });
    expect(bumpAttempt('not-json')).toBeNull();
  });
});
