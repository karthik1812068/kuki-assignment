import { describe, expect, it } from 'vitest';
import {
  GitHubOAuthClient,
  GitHubRequestError,
  buildAuthorizeUrl,
  parseAccessGrant,
  parseGitHubUser,
  primaryVerifiedEmail,
} from './oauth';

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  callbackUrl: 'http://localhost:4000/auth/github/callback',
};

describe('buildAuthorizeUrl', () => {
  it('sends the public OAuth parameters and keeps the client secret out of the URL', () => {
    const url = new URL(
      buildAuthorizeUrl(config, {
        state: 'a'.repeat(43),
        verifier: 'b'.repeat(43),
      }),
    );

    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('repo');
    expect(url.searchParams.has('client_secret')).toBe(false);
    expect(url.searchParams.get('code_challenge')).not.toBe('b'.repeat(43));
  });
});

describe('parseAccessGrant', () => {
  it('reads a token and scopes', () => {
    expect(
      parseAccessGrant({ access_token: 'gho_example_token', scope: 'read:user,repo' }),
    ).toEqual({
      accessToken: 'gho_example_token',
      scopes: ['read:user', 'repo'],
    });
  });

  it('does not copy GitHub error text into the exception', () => {
    expect(() =>
      parseAccessGrant({
        error: 'bad_verification_code',
        error_description: 'rejected gho_secret_token',
      }),
    ).toThrow(GitHubRequestError);
    try {
      parseAccessGrant({
        error: 'bad_verification_code',
        error_description: 'rejected gho_secret_token',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubRequestError);
      expect((error as Error).message).not.toContain('gho_secret_token');
    }
  });
});

describe('parseGitHubUser', () => {
  it('keeps a GitHub avatar and drops other image hosts', () => {
    expect(
      parseGitHubUser({
        id: 42,
        login: 'octocat',
        name: 'Octo',
        email: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/42?v=4',
      }).avatarUrl,
    ).toBe('https://avatars.githubusercontent.com/u/42?v=4');

    expect(
      parseGitHubUser({
        id: 42,
        login: 'octocat',
        avatar_url: 'https://evil.example/avatar.png',
      }).avatarUrl,
    ).toBeNull();
  });
});

describe('primaryVerifiedEmail', () => {
  it('prefers the primary verified address', () => {
    expect(
      primaryVerifiedEmail([
        { email: 'other@example.com', primary: false, verified: true },
        { email: 'ada@example.com', primary: true, verified: true },
      ]),
    ).toBe('ada@example.com');
  });
});

describe('GitHubOAuthClient', () => {
  it('posts the code exchange without putting the token in an error', async () => {
    const client = new GitHubOAuthClient(config, (url, init) => {
      if (typeof url !== 'string' || typeof init?.body !== 'string') {
        throw new Error('expected a string request');
      }
      expect(url).toBe('https://github.com/login/oauth/access_token');
      const body = JSON.parse(init.body) as { client_secret?: string };
      expect(body.client_secret).toBe('client-secret');
      return Promise.resolve(
        new Response(
          JSON.stringify({ error: 'bad_verification_code', error_description: 'gho_secret_token' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    await expect(client.exchange({ code: 'abc1234567', verifier: 'verifier' })).rejects.toThrow(
      GitHubRequestError,
    );
  });
});
