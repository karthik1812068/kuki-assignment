import { createHash } from 'node:crypto';

export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_API_USER = 'https://api.github.com/user';
export const GITHUB_API_EMAILS = 'https://api.github.com/user/emails';
export const GITHUB_OAUTH_SCOPES = ['read:user', 'user:email', 'repo'] as const;

const USER_AGENT = 'codepilot-ai';

export class GitHubRequestError extends Error {
  constructor() {
    super('GitHub could not complete the request.');
    this.name = 'GitHubRequestError';
  }
}

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface GitHubProfile {
  githubId: string;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface GitHubAccessGrant {
  accessToken: string;
  scopes: string[];
}

export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function buildAuthorizeUrl(
  config: Pick<GitHubOAuthConfig, 'clientId' | 'callbackUrl'>,
  input: { state: string; verifier: string },
): string {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.callbackUrl);
  url.searchParams.set('scope', GITHUB_OAUTH_SCOPES.join(' '));
  url.searchParams.set('state', input.state);
  url.searchParams.set('code_challenge', codeChallenge(input.verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export class GitHubOAuthClient {
  constructor(
    private readonly config: GitHubOAuthConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  authorizeUrl(input: { state: string; verifier: string }): string {
    return buildAuthorizeUrl(this.config, input);
  }

  async exchange(input: { code: string; verifier: string }): Promise<GitHubAccessGrant> {
    const response = await this.fetchImpl(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: input.code,
        redirect_uri: this.config.callbackUrl,
        code_verifier: input.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new GitHubRequestError();
    }
    return parseAccessGrant(body);
  }

  async profile(accessToken: string): Promise<GitHubProfile> {
    const user = await this.get(GITHUB_API_USER, accessToken);
    const profile = parseGitHubUser(user);
    if (profile.email) {
      return profile;
    }

    try {
      const emails = await this.get(GITHUB_API_EMAILS, accessToken);
      return { ...profile, email: primaryVerifiedEmail(emails) };
    } catch {
      return profile;
    }
  }

  private async get(url: string, accessToken: string): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new GitHubRequestError();
    }
    return body;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > 1_000_000) {
    throw new GitHubRequestError();
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GitHubRequestError();
  }
}

export function parseAccessGrant(value: unknown): GitHubAccessGrant {
  if (!value || typeof value !== 'object') {
    throw new GitHubRequestError();
  }
  const record = value as Record<string, unknown>;
  if (typeof record.error === 'string') {
    throw new GitHubRequestError();
  }
  if (typeof record.access_token !== 'string' || !/^\S{10,2000}$/.test(record.access_token)) {
    throw new GitHubRequestError();
  }

  const rawScopes = typeof record.scope === 'string' ? record.scope : '';
  const scopes = rawScopes
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter((scope) => /^[a-z0-9_:]+$/i.test(scope));

  return { accessToken: record.access_token, scopes };
}

export function parseGitHubUser(value: unknown): GitHubProfile {
  if (!value || typeof value !== 'object') {
    throw new GitHubRequestError();
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'number' || !Number.isSafeInteger(record.id) || record.id <= 0) {
    throw new GitHubRequestError();
  }
  if (typeof record.login !== 'string' || !/^[A-Za-z0-9-]{1,39}$/.test(record.login)) {
    throw new GitHubRequestError();
  }

  return {
    githubId: String(record.id),
    login: record.login,
    name: boundedText(record.name, 200),
    email: emailOrNull(record.email),
    avatarUrl: avatarOrNull(record.avatar_url),
  };
}

export function primaryVerifiedEmail(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const emails = value.filter(
    (item): item is Record<string, unknown> => !!item && typeof item === 'object',
  );
  const primary = emails.find((item) => item.primary === true && item.verified === true);
  const verified = emails.find((item) => item.verified === true);
  return emailOrNull((primary ?? verified)?.email);
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    return null;
  }
  return trimmed;
}

function emailOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 320 || !value.includes('@')) {
    return null;
  }
  return value;
}

function avatarOrNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'avatars.githubusercontent.com') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
