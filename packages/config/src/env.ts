import path from 'node:path';
import { z } from 'zod';
import { loadRepoEnv } from './repo-root';

const httpUrl = z.string().refine(isHttpUrl, 'must be an http(s) URL');

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'postgresql:' || url.protocol === 'postgres:';
  } catch {
    return false;
  }
}

function isRedisUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'redis:' || url.protocol === 'rediss:';
  } catch {
    return false;
  }
}

function emptyToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}

function withDefault(fallback: string) {
  return (value: unknown): unknown => {
    if (value === undefined || value === '') {
      return fallback;
    }
    return value;
  };
}

const optionalSecret = (minimum: number) =>
  z.preprocess(emptyToUndefined, z.string().min(minimum).optional());

const llmBaseUrl = z.string().refine((value) => {
  try {
    return isAllowedLlmBaseUrl(new URL(value));
  } catch {
    return false;
  }
}, 'must be an https URL, or http on localhost');

function isAllowedLlmBaseUrl(url: URL): boolean {
  if (url.username !== '' || url.password !== '') {
    return false;
  }
  if (url.protocol === 'http:') {
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  }
  if (url.protocol !== 'https:') {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (host === 'metadata.google.internal' || host === '169.254.169.254') {
    return false;
  }
  return !isPrivateIpv4(host);
}

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) {
    return false;
  }
  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part > 255)) {
    return false;
  }
  const [a, b] = octets;
  if (a === undefined || b === undefined) {
    return false;
  }
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

export const foundationEnvSchema = z.object({
  NODE_ENV: z.preprocess(withDefault('development'), z.enum(['development', 'test', 'production'])),
  LOG_LEVEL: z.preprocess(
    withDefault('info'),
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  ),
  DATABASE_URL: z.string().refine(isPostgresUrl, 'must be a postgres connection URL'),
  REDIS_URL: z.string().refine(isRedisUrl, 'must be a redis connection URL'),
  API_PORT: z.preprocess(withDefault('4000'), z.coerce.number().int().min(1).max(65535)),
  WEB_ORIGIN: z.preprocess(withDefault('http://localhost:3000'), httpUrl),
  NEXT_PUBLIC_API_URL: z.preprocess(emptyToUndefined, httpUrl.optional()),
  GITHUB_CLIENT_ID: optionalSecret(1),
  GITHUB_CLIENT_SECRET: optionalSecret(1),
  GITHUB_CALLBACK_URL: z.preprocess(emptyToUndefined, httpUrl.optional()),
  LLM_API_KEY: optionalSecret(16),
  LLM_MODEL: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^[A-Za-z0-9._:/-]{1,80}$/)
      .optional(),
  ),
  LLM_BASE_URL: z.preprocess(emptyToUndefined, llmBaseUrl.optional()),
  JWT_SECRET: optionalSecret(32),
  ENCRYPTION_KEY: optionalSecret(32),
  AGENT_REPAIR_LIMIT: z.preprocess(withDefault('3'), z.coerce.number().int().min(1).max(5)),
  AGENT_TOKEN_BUDGET: z.preprocess(
    withDefault('20000'),
    z.coerce.number().int().min(1000).max(200_000),
  ),
  TASK_RATE_LIMIT: z.preprocess(withDefault('20'), z.coerce.number().int().min(1).max(100)),
  SANDBOX_IMAGE: z.preprocess(
    withDefault('node:22-bookworm-slim'),
    z.string().regex(/^[a-z0-9][a-z0-9._:/-]{0,120}$/),
  ),
  LLM_INPUT_USD_PER_MILLION: z.preprocess(
    emptyToUndefined,
    z.coerce.number().min(0).max(1000).optional(),
  ),
  LLM_OUTPUT_USD_PER_MILLION: z.preprocess(
    emptyToUndefined,
    z.coerce.number().min(0).max(1000).optional(),
  ),
  REPOSITORIES_DIR: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .refine(
        (value) => path.isAbsolute(value) && !value.includes('\0'),
        'must be an absolute path',
      )
      .optional(),
  ),
});

export type FoundationEnv = z.infer<typeof foundationEnvSchema>;

export function parseFoundationEnv(input: Record<string, unknown>): FoundationEnv {
  const result = foundationEnvSchema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.') || '(root)');
    const uniqueFields = [...new Set(fields)];
    throw new Error(`Invalid environment configuration: ${uniqueFields.join(', ')}`);
  }
  return result.data;
}

export function loadFoundationEnv(start = process.cwd()): FoundationEnv {
  loadRepoEnv(start);
  return parseFoundationEnv(process.env);
}
