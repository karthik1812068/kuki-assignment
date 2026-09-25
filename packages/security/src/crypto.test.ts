import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto';

const secret = 'local-development-encryption-key-32';

describe('encryptSecret', () => {
  it('round-trips a token and does not store it in the clear', () => {
    const token = 'gho_example_token_value';
    const stored = encryptSecret(token, secret);

    expect(stored.startsWith('v1.')).toBe(true);
    expect(stored).not.toContain(token);
    expect(decryptSecret(stored, secret)).toBe(token);
  });

  it('rejects a payload that was modified', () => {
    const stored = encryptSecret('gho_example_token_value', secret);
    const tampered = `${stored.slice(0, -4)}aaaa`;

    expect(() => decryptSecret(tampered, secret)).toThrow('The stored secret could not be read.');
    expect(() => decryptSecret(stored, 'another-key-that-is-long-enough')).toThrow(
      'The stored secret could not be read.',
    );
  });
});
