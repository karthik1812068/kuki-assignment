import type { GitHubOAuthClient } from '@codepilot/github';
import type { PgAuthRepository, StoredUser } from '@codepilot/database';
import { decryptSecret } from '@codepilot/security';
import { describe, expect, it } from 'vitest';
import { AuthFlowError, AuthService, toCurrentUser } from './auth.service';
import type { OAuthStateStore } from './oauth-state.store';

const encryptionKey = 'local-development-encryption-key-32';
const token = 'gho_example_token_value';

describe('AuthService', () => {
  it('stores an encrypted token and returns a public user', async () => {
    const saved: { ciphertext?: string } = {};
    const service = new AuthService({
      encryptionKey,
      github: fakeGitHub(),
      states: fakeStates({ verifier: 'b'.repeat(43), nextPath: '/tasks/12' }),
      store: fakeStore(saved),
      createChallenge: () => ({ state: 'a'.repeat(43), verifier: 'b'.repeat(43) }),
      now: () => new Date('2026-09-24T00:00:00.000Z'),
    });

    const started = await service.startLogin('/tasks/12');
    expect(started.url).toContain('github.com');
    expect(started.url).not.toContain(token);

    const result = await service.completeLogin({ code: 'abc1234567', state: 'a'.repeat(43) });

    expect(saved.ciphertext).toBeDefined();
    expect(saved.ciphertext).not.toContain(token);
    expect(decryptSecret(saved.ciphertext ?? '', encryptionKey)).toBe(token);
    expect(result.redirectPath).toBe('/tasks/12');
    expect(result.user).toEqual({
      id: 'user-1',
      githubId: '42',
      login: 'octocat',
      name: 'Octo',
      email: 'ada@example.com',
      avatarUrl: null,
      scopes: ['read:user', 'repo'],
    });
    expect(result.user).not.toHaveProperty('accessToken');
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it('rejects a reused OAuth state', async () => {
    const service = new AuthService({
      encryptionKey,
      github: fakeGitHub(),
      states: fakeStates(null),
      store: fakeStore({}),
    });

    await expect(
      service.completeLogin({ code: 'abc1234567', state: 'a'.repeat(43) }),
    ).rejects.toBeInstanceOf(AuthFlowError);
  });
});

describe('toCurrentUser', () => {
  it('splits stored scopes and omits credentials', () => {
    const user = toCurrentUser(
      {
        id: 'user-1',
        githubId: '42',
        githubLogin: 'octocat',
        name: null,
        email: null,
        avatarUrl: null,
      },
      'read:user repo',
    );
    expect(user.scopes).toEqual(['read:user', 'repo']);
    expect(user).not.toHaveProperty('accessToken');
  });
});

function fakeGitHub(): GitHubOAuthClient {
  return {
    authorizeUrl: () => 'https://github.com/login/oauth/authorize?client_id=client-id',
    exchange: () => Promise.resolve({ accessToken: token, scopes: ['read:user', 'repo'] }),
    profile: () =>
      Promise.resolve({
        githubId: '42',
        login: 'octocat',
        name: 'Octo',
        email: 'ada@example.com',
        avatarUrl: null,
      }),
  } as unknown as GitHubOAuthClient;
}

function fakeStates(pending: { verifier: string; nextPath: string } | null): OAuthStateStore {
  return {
    save: () => Promise.resolve(),
    consume: () => Promise.resolve(pending),
  };
}

function fakeStore(saved: { ciphertext?: string }): PgAuthRepository {
  const user: StoredUser = {
    id: 'user-1',
    githubId: '42',
    githubLogin: 'octocat',
    email: 'ada@example.com',
    name: 'Octo',
    avatarUrl: null,
  };
  return {
    upsertUser: () => Promise.resolve(user),
    saveCredential: (_userId: string, ciphertext: string) => {
      saved.ciphertext = ciphertext;
      return Promise.resolve();
    },
    createSession: () => Promise.resolve({ id: 'c'.repeat(43), maxAgeSeconds: 60 }),
    findSessionUser: () => Promise.resolve(null),
    revokeSession: () => Promise.resolve(),
    deleteUserByGitHubId: () => Promise.resolve(),
  } as unknown as PgAuthRepository;
}
