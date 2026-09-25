import { describe, expect, it } from 'vitest';
import { redactSensitive } from './redact';

describe('redactSensitive', () => {
  it('redacts sensitive keys and keeps surrounding data', () => {
    const result = redactSensitive({
      user: 'ada',
      token: 'abc',
      nested: { apiKey: 'xyz', file: 'src/app.ts' },
      items: [{ password: 'hunter2' }],
    });

    expect(result).toEqual({
      user: 'ada',
      token: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', file: 'src/app.ts' },
      items: [{ password: '[REDACTED]' }],
    });
  });
});
