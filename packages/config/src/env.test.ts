import { describe, expect, it } from 'vitest';
import { parseFoundationEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://codepilot:codepilot@localhost:5432/codepilot',
  REDIS_URL: 'redis://localhost:6379',
};

describe('parseFoundationEnv', () => {
  it('applies foundation defaults', () => {
    const env = parseFoundationEnv(valid);

    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.API_PORT).toBe(4000);
    expect(env.WEB_ORIGIN).toBe('http://localhost:3000');
    expect(env.GITHUB_CLIENT_ID).toBeUndefined();
    expect(env.LLM_API_KEY).toBeUndefined();
    expect(env.AGENT_REPAIR_LIMIT).toBe(3);
    expect(env.SANDBOX_IMAGE).toBe('node:22-bookworm-slim');
    expect(env.LLM_INPUT_USD_PER_MILLION).toBeUndefined();
  });

  it('treats blank optional secrets as unset', () => {
    const env = parseFoundationEnv({
      ...valid,
      GITHUB_CLIENT_SECRET: '   ',
      JWT_SECRET: '',
      ENCRYPTION_KEY: '',
    });

    expect(env.GITHUB_CLIENT_SECRET).toBeUndefined();
    expect(env.JWT_SECRET).toBeUndefined();
    expect(env.ENCRYPTION_KEY).toBeUndefined();
  });

  it('rejects invalid configuration without echoing the value', () => {
    const secret = 'super-secret-database-value';

    expect(() => parseFoundationEnv({ ...valid, DATABASE_URL: secret })).toThrow(
      /Invalid environment configuration: DATABASE_URL/,
    );
    expect(() => parseFoundationEnv({ ...valid, DATABASE_URL: secret })).toThrow(
      new RegExp(`^(?!.*${secret}).*$`),
    );
  });

  it('rejects short session secrets when they are set', () => {
    expect(() => parseFoundationEnv({ ...valid, JWT_SECRET: 'too-short' })).toThrow(/JWT_SECRET/);
  });

  it('accepts a localhost model URL and rejects a public http URL', () => {
    expect(
      parseFoundationEnv({ ...valid, LLM_BASE_URL: 'http://127.0.0.1:11434/v1' }).LLM_BASE_URL,
    ).toBe('http://127.0.0.1:11434/v1');
    expect(() => parseFoundationEnv({ ...valid, LLM_BASE_URL: 'http://example.com/v1' })).toThrow(
      /LLM_BASE_URL/,
    );
  });

  it('drops unrelated environment keys', () => {
    const env = parseFoundationEnv({ ...valid, PATH: 'C:\\Windows' });

    expect(env).not.toHaveProperty('PATH');
  });
});
