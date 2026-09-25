import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function resolveRequestId(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value === 'string' && REQUEST_ID_PATTERN.test(value)) {
    return value;
  }
  return randomUUID();
}
