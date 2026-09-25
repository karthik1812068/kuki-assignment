import type { CurrentUser } from '@codepilot/types';

export function parseCurrentUser(value: unknown): CurrentUser | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.githubId !== 'string' ||
    typeof record.login !== 'string'
  ) {
    return null;
  }
  if (!Array.isArray(record.scopes) || !record.scopes.every((scope) => typeof scope === 'string')) {
    return null;
  }

  return {
    id: record.id,
    githubId: record.githubId,
    login: record.login,
    name: typeof record.name === 'string' ? record.name : null,
    email: typeof record.email === 'string' ? record.email : null,
    avatarUrl:
      typeof record.avatarUrl === 'string' && record.avatarUrl.startsWith('https://')
        ? record.avatarUrl
        : null,
    scopes: record.scopes,
  };
}
