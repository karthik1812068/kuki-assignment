import { randomBytes } from 'node:crypto';
import type { GitHubOAuthClient } from '@codepilot/github';
import type { PgAuthRepository } from '@codepilot/database';
import { isSessionId } from '@codepilot/database';
import { decryptSecret, encryptSecret } from '@codepilot/security';
import { SESSION_COOKIE_NAME, safeAppPath, type CurrentUser } from '@codepilot/types';
import type { OAuthStateStore } from './oauth-state.store';
import { readCookie } from './session-cookie';

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const AUTHORIZATION_CODE = /^[A-Za-z0-9._-]{10,200}$/;

export type AuthFailure = 'not_configured' | 'oauth_failed' | 'unavailable';

export class AuthFlowError extends Error {
  constructor(readonly reason: AuthFailure) {
    super(reason);
    this.name = 'AuthFlowError';
  }
}

export interface LoginSuccess {
  sessionId: string;
  maxAgeSeconds: number;
  redirectPath: string;
  user: CurrentUser;
}

export interface AuthServiceOptions {
  store: PgAuthRepository;
  states: OAuthStateStore;
  github: GitHubOAuthClient | null;
  encryptionKey: string | undefined;
  now?: () => Date;
  createChallenge?: () => { state: string; verifier: string };
}

export class AuthService {
  private readonly now: () => Date;
  private readonly createChallenge: () => { state: string; verifier: string };

  constructor(private readonly options: AuthServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.createChallenge =
      options.createChallenge ??
      (() => ({
        state: randomBytes(32).toString('base64url'),
        verifier: randomBytes(32).toString('base64url'),
      }));
  }

  async startLogin(next: unknown): Promise<{ url: string }> {
    const github = this.configuredGitHub();
    const challenge = this.createChallenge();
    try {
      await this.options.states.save(challenge.state, {
        verifier: challenge.verifier,
        nextPath: safeAppPath(next),
      });
    } catch (error) {
      if (error instanceof AuthFlowError) {
        throw error;
      }
      throw new AuthFlowError('unavailable');
    }
    return { url: github.authorizeUrl(challenge) };
  }

  async completeLogin(input: { code: unknown; state: unknown }): Promise<LoginSuccess> {
    const github = this.configuredGitHub();
    const key = this.options.encryptionKey;
    if (!key) {
      throw new AuthFlowError('not_configured');
    }
    if (typeof input.code !== 'string' || !AUTHORIZATION_CODE.test(input.code)) {
      throw new AuthFlowError('oauth_failed');
    }
    if (typeof input.state !== 'string' || !isSessionId(input.state)) {
      throw new AuthFlowError('oauth_failed');
    }

    const pending = await this.options.states.consume(input.state);
    if (!pending) {
      throw new AuthFlowError('oauth_failed');
    }

    const grant = await github.exchange({ code: input.code, verifier: pending.verifier });
    const profile = await github.profile(grant.accessToken);
    const user = await this.options.store.upsertUser(profile);
    const ciphertext = encryptSecret(grant.accessToken, key);
    await this.options.store.saveCredential(user.id, ciphertext, grant.scopes.join(' '));
    const session = await this.options.store.createSession(user.id, this.now(), SESSION_TTL_MS);

    return {
      sessionId: session.id,
      maxAgeSeconds: session.maxAgeSeconds,
      redirectPath: pending.nextPath,
      user: toCurrentUser(user, grant.scopes.join(' ')),
    };
  }

  async currentUser(cookieHeader: string | undefined): Promise<CurrentUser | null> {
    const sessionId = readCookie(cookieHeader, SESSION_COOKIE_NAME);
    if (!sessionId || !isSessionId(sessionId)) {
      return null;
    }
    const found = await this.options.store.findSessionUser(sessionId, this.now());
    if (!found) {
      return null;
    }
    return toCurrentUser(found.user, found.scopes);
  }

  async githubAccessToken(userId: string): Promise<string | null> {
    const key = this.options.encryptionKey;
    if (!key) {
      return null;
    }
    const stored = await this.options.store.findCredential(userId);
    if (!stored) {
      return null;
    }
    return decryptSecret(stored.ciphertext, key);
  }

  async revokeCookie(cookieHeader: string | undefined): Promise<void> {
    const sessionId = readCookie(cookieHeader, SESSION_COOKIE_NAME);
    if (!sessionId || !isSessionId(sessionId)) {
      return;
    }
    await this.options.store.revokeSession(sessionId);
  }

  private configuredGitHub(): GitHubOAuthClient {
    if (!this.options.github || !this.options.encryptionKey) {
      throw new AuthFlowError('not_configured');
    }
    return this.options.github;
  }
}

export function toCurrentUser(
  user: {
    id: string;
    githubId: string;
    githubLogin: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  },
  scopes: string,
): CurrentUser {
  return {
    id: user.id,
    githubId: user.githubId,
    login: user.githubLogin,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    scopes: scopes.split(/[\s,]+/).filter((scope) => scope.length > 0),
  };
}
