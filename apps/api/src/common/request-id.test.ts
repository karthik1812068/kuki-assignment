import { describe, expect, it } from 'vitest';
import { resolveRequestId } from './request-id';

describe('resolveRequestId', () => {
  it('keeps a safe caller-supplied id', () => {
    expect(resolveRequestId('req_12345678')).toBe('req_12345678');
  });

  it('replaces missing, unsafe, or ambiguous ids', () => {
    expect(resolveRequestId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(resolveRequestId('bad id\ninjected')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(resolveRequestId(['short', 'another'])).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
