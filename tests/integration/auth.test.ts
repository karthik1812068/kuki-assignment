import { randomUUID } from 'node:crypto';
import { PgAuthRepository, createPostgresPool, runMigrations } from '@codepilot/database';
import { decryptSecret, encryptSecret } from '@codepilot/security';
import { afterAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const encryptionKey = 'local-development-encryption-key-32';

describe.skipIf(!databaseUrl)('github sign-in records', () => {
  const githubId = String(8_000_000_000_000 + (Date.now() % 1_000_000));
  const token = `gho_${randomUUID().replaceAll('-', '')}`;
  let repository: PgAuthRepository | undefined;
  let pool: ReturnType<typeof createPostgresPool> | undefined;

  afterAll(async () => {
    if (repository) {
      await repository.deleteUserByGitHubId(githubId);
    }
    await pool?.end();
  });

  it('saves a user, an encrypted token, and a session that logout revokes', async () => {
    await runMigrations(databaseUrl ?? '');
    pool = createPostgresPool(databaseUrl ?? '');
    repository = new PgAuthRepository(pool);
    const user = await repository.upsertUser({
      githubId,
      login: 'octocat',
      name: 'Octo',
      email: 'ada@example.com',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
    });
    const ciphertext = encryptSecret(token, encryptionKey);
    await repository.saveCredential(user.id, ciphertext, 'read:user repo');
    const session = await repository.createSession(user.id, new Date(), 60_000);

    const active = await repository.findSessionUser(session.id, new Date());
    expect(active?.user.githubLogin).toBe('octocat');
    expect(active?.scopes).toBe('read:user repo');
    expect(decryptSecret(active ? ciphertext : '', encryptionKey)).toBe(token);
    expect(ciphertext).not.toContain(token);

    const renamed = await repository.upsertUser({
      githubId,
      login: 'octocat',
      name: 'Ada',
      email: null,
      avatarUrl: null,
    });
    expect(renamed.id).toBe(user.id);
    expect(renamed.name).toBe('Ada');

    await repository.revokeSession(session.id);
    expect(await repository.findSessionUser(session.id, new Date())).toBeNull();
  });
});
