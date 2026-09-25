import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';

function keyBytes(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** Encrypt a secret for storage. The result does not include the plaintext. */
export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/** Decrypt a value produced by encryptSecret. Failures use a fixed message. */
export function decryptSecret(payload: string, secret: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('The stored secret could not be read.');
  }

  const iv = parts[1] ?? '';
  const tag = parts[2] ?? '';
  const ciphertext = parts[3] ?? '';

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyBytes(secret),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    throw new Error('The stored secret could not be read.');
  }
}
