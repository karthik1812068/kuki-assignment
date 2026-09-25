import { describe, expect, it } from 'vitest';
import { parseCurrentUser } from './parse-current-user';

describe('parseCurrentUser', () => {
  it('keeps the public profile and drops a token field', () => {
    const user = parseCurrentUser({
      id: 'user-1',
      githubId: '42',
      login: 'octocat',
      name: 'Octo',
      email: 'ada@example.com',
      avatarUrl: 'https://avatars.githubusercontent.com/u/42',
      scopes: ['repo'],
      accessToken: 'gho_secret_token',
    });

    expect(user?.login).toBe('octocat');
    expect(user).not.toHaveProperty('accessToken');
    expect(JSON.stringify(user)).not.toContain('gho_secret_token');
  });

  it('rejects a body that is not a user', () => {
    expect(parseCurrentUser({ login: 'octocat' })).toBeNull();
  });
});
