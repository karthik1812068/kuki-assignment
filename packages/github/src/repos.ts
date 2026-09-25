import { GitHubRequestError } from './oauth';

const GITHUB_API_BASE = 'https://api.github.com';

const USER_AGENT = 'codepilot-ai';
const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export class GitHubAuthError extends GitHubRequestError {
  override readonly name = 'GitHubAuthError';
}

export interface GitHubRepositoryChoice {
  githubRepoId: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  language: string | null;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  permission: 'admin' | 'maintain' | 'write' | 'triage' | 'read';
}

export function isRepositoryFullName(value: string): boolean {
  return FULL_NAME.test(value) && !value.includes('..');
}

export function assertCloneBranch(branch: string): void {
  if (
    !/^[A-Za-z0-9._/-]{1,250}$/.test(branch) ||
    branch.startsWith('-') ||
    branch.startsWith('/') ||
    branch.includes('..') ||
    branch.includes('\\')
  ) {
    throw new GitHubRequestError();
  }
}

export function gitClonePlan(input: {
  fullName: string;
  branch: string;
  destination: string;
  token: string;
}): { command: string; args: string[]; header: string } {
  if (!isRepositoryFullName(input.fullName)) {
    throw new GitHubRequestError();
  }
  assertCloneBranch(input.branch);
  return {
    command: 'git',
    args: [
      '-c',
      'credential.helper=',
      'clone',
      '--depth',
      '1',
      '--single-branch',
      '--branch',
      input.branch,
      `https://github.com/${input.fullName}.git`,
      input.destination,
    ],
    header: `Authorization: Bearer ${input.token}`,
  };
}

export async function listUserRepositories(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
  maxPages = 3,
): Promise<GitHubRepositoryChoice[]> {
  const choices: GitHubRepositoryChoice[] = [];
  let next: string | null =
    `${GITHUB_API_BASE}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`;
  let pages = 0;

  while (next && pages < maxPages) {
    const response = await githubGet(next, accessToken, fetchImpl);
    if (!Array.isArray(response.body)) {
      throw new GitHubRequestError();
    }
    for (const item of response.body) {
      const parsed = parseGitHubRepository(item);
      if (parsed) {
        choices.push(parsed);
      }
    }
    next = nextGitHubPage(response.link);
    pages += 1;
  }

  return choices;
}

export async function getUserRepository(
  accessToken: string,
  fullName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubRepositoryChoice | null> {
  if (!isRepositoryFullName(fullName)) {
    return null;
  }
  const [owner, repo] = fullName.split('/');
  const response = await githubGet(
    `${GITHUB_API_BASE}/repos/${owner ?? ''}/${repo ?? ''}`,
    accessToken,
    fetchImpl,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new GitHubRequestError();
  }
  const parsed = parseGitHubRepository(response.body);
  if (!parsed) {
    throw new GitHubRequestError();
  }
  return parsed;
}

export function parseGitHubRepository(value: unknown): GitHubRepositoryChoice | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'number' || !Number.isSafeInteger(record.id) || record.id <= 0) {
    return null;
  }
  if (typeof record.name !== 'string' || typeof record.full_name !== 'string') {
    return null;
  }
  if (!isRepositoryFullName(record.full_name) || !record.full_name.endsWith(`/${record.name}`)) {
    return null;
  }
  if (typeof record.default_branch !== 'string') {
    return null;
  }
  try {
    assertCloneBranch(record.default_branch);
  } catch {
    return null;
  }
  const htmlUrl = githubHtmlUrl(record.html_url, record.full_name);
  if (!htmlUrl || typeof record.private !== 'boolean') {
    return null;
  }

  return {
    githubRepoId: String(record.id),
    name: record.name,
    fullName: record.full_name,
    defaultBranch: record.default_branch,
    language: bounded(record.language, 64),
    description: bounded(record.description, 500),
    private: record.private,
    htmlUrl,
    permission: permissionFrom(record.permissions),
  };
}

export function nextGitHubPage(header: string | null): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(',')) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part);
    const candidate = match?.[1];
    if (!candidate) {
      continue;
    }
    try {
      const url = new URL(candidate);
      if (url.origin === 'https://api.github.com') {
        return url.toString();
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function githubGet(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<{ status: number; ok: boolean; body: unknown; link: string | null }> {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://api.github.com') {
    throw new GitHubRequestError();
  }
  const response = await fetchImpl(parsed, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401) {
    throw new GitHubAuthError();
  }
  const text = await response.text();
  if (text.length > 5_000_000) {
    throw new GitHubRequestError();
  }
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new GitHubRequestError();
    }
  }
  if (!response.ok && response.status !== 404) {
    throw new GitHubRequestError();
  }
  return { status: response.status, ok: response.ok, body, link: response.headers.get('link') };
}

function githubHtmlUrl(value: unknown, fullName: string): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.pathname !== `/${fullName}`
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function stripControls(value: string): string {
  let result = '';
  for (const char of value) {
    if (char.charCodeAt(0) > 0x1f) {
      result += char;
    }
  }
  return result;
}

function bounded(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = stripControls(value).trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    return null;
  }
  return trimmed;
}

function permissionFrom(value: unknown): GitHubRepositoryChoice['permission'] {
  if (!value || typeof value !== 'object') {
    return 'read';
  }
  const record = value as Record<string, unknown>;
  if (record.admin === true) {
    return 'admin';
  }
  if (record.maintain === true) {
    return 'maintain';
  }
  if (record.push === true) {
    return 'write';
  }
  if (record.triage === true) {
    return 'triage';
  }
  return 'read';
}
