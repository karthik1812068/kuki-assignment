import { describe, expect, it } from 'vitest';
import { isResourceId } from './resource-id';

describe('isResourceId', () => {
  it('accepts uuid and positive integer ids', () => {
    expect(isResourceId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isResourceId('12345')).toBe(true);
  });

  it('rejects path-like and empty ids', () => {
    expect(isResourceId('../etc/passwd')).toBe(false);
    expect(isResourceId('0')).toBe(false);
    expect(isResourceId('')).toBe(false);
    expect(isResourceId('01')).toBe(false);
  });
});
