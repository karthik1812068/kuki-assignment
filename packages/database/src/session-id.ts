import { randomBytes } from 'node:crypto';

export function createSessionId(bytes: (size: number) => Buffer = randomBytes): string {
  return bytes(32).toString('base64url');
}

export function isSessionId(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
