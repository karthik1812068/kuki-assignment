import type { Redis } from 'ioredis';
import { safeAppPath } from '@codepilot/types';

const PREFIX = 'codepilot:oauth-state:';
const TTL_SECONDS = 600;

export interface OAuthState {
  verifier: string;
  nextPath: string;
}

export interface OAuthStateStore {
  save(state: string, payload: OAuthState): Promise<void>;
  consume(state: string): Promise<OAuthState | null>;
}

export class RedisOAuthStateStore implements OAuthStateStore {
  constructor(private readonly redis: Redis) {}

  async save(state: string, payload: OAuthState): Promise<void> {
    await this.ready();
    await this.redis.set(PREFIX + state, JSON.stringify(payload), 'EX', TTL_SECONDS);
  }

  async consume(state: string): Promise<OAuthState | null> {
    await this.ready();
    const raw = await this.redis.getdel(PREFIX + state);
    if (!raw || raw.length > 1_000) {
      return null;
    }
    return parseState(raw);
  }

  private async ready(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
  }
}

function parseState(raw: string): OAuthState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(record.verifier)) {
      return null;
    }
    return { verifier: record.verifier, nextPath: safeAppPath(record.nextPath) };
  } catch {
    return null;
  }
}
