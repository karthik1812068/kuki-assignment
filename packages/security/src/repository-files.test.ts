import { describe, expect, it } from 'vitest';
import { isIgnoredRepositoryPath, isSecretRepositoryPath } from './repository-files';

describe('repository file policy', () => {
  it('blocks secrets and environment files', () => {
    expect(isSecretRepositoryPath('.env')).toBe(true);
    expect(isSecretRepositoryPath('src/.env.local')).toBe(true);
    expect(isSecretRepositoryPath('keys/id_rsa')).toBe(true);
    expect(isSecretRepositoryPath('certs/server.pem')).toBe(true);
    expect(isSecretRepositoryPath('config/credentials.json')).toBe(true);
    expect(isSecretRepositoryPath('config/secrets.json')).toBe(true);
    expect(isSecretRepositoryPath('config/api-token.txt')).toBe(true);
  });

  it('keeps ordinary source files', () => {
    expect(isSecretRepositoryPath('src/auth/token.ts')).toBe(false);
    expect(isSecretRepositoryPath('src/auth/service.ts')).toBe(false);
    expect(isSecretRepositoryPath('docs/secretary.md')).toBe(false);
    expect(isIgnoredRepositoryPath('src/auth/service.ts')).toBe(false);
  });

  it('ignores dependencies, build output, binaries, and temporary files', () => {
    expect(isIgnoredRepositoryPath('node_modules/leftpad/index.js')).toBe(true);
    expect(isIgnoredRepositoryPath('.git/config')).toBe(true);
    expect(isIgnoredRepositoryPath('dist/main.js')).toBe(true);
    expect(isIgnoredRepositoryPath('assets/logo.png')).toBe(true);
    expect(isIgnoredRepositoryPath('notes.txt~')).toBe(true);
    expect(isIgnoredRepositoryPath('.github/workflows/ci.yml')).toBe(false);
  });
});
