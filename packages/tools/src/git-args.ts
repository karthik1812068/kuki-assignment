import { isWorkspacePath } from './proposal';

const BRANCH = /^[A-Za-z0-9._/-]{1,100}$/;

export function isSafeBranch(branch: string): boolean {
  return (
    BRANCH.test(branch) &&
    !branch.startsWith('-') &&
    !branch.startsWith('/') &&
    !branch.endsWith('/') &&
    !branch.includes('..') &&
    !branch.includes('//')
  );
}

export function gitStatusArgs(): string[] {
  return ['git', 'status', '--porcelain', '--untracked-files=all'];
}

export function gitDiffArgs(filePath?: string): string[] | null {
  if (filePath === undefined) {
    return ['git', 'diff', '--'];
  }
  if (!isWorkspacePath(filePath)) {
    return null;
  }
  return ['git', 'diff', '--', filePath];
}

export function gitBranchArgs(branch: string): string[] | null {
  if (!isSafeBranch(branch)) {
    return null;
  }
  return ['git', 'checkout', '-b', branch];
}

export function gitAddArgs(paths: readonly string[]): string[] | null {
  if (paths.length === 0 || paths.length > 8 || paths.some((entry) => !isWorkspacePath(entry))) {
    return null;
  }
  return ['git', 'add', '--', ...paths];
}

export function gitCommitArgs(message: string): string[] | null {
  let clean = '';
  for (const char of message) {
    const code = char.charCodeAt(0);
    if (code > 31 && code !== 127) {
      clean += char;
    }
  }
  clean = clean.trim();
  if (clean.length === 0 || clean.length > 200) {
    return null;
  }
  return [
    'git',
    '-c',
    'user.name=CodePilot',
    '-c',
    'user.email=codepilot@localhost',
    'commit',
    '-m',
    clean,
  ];
}

export function gitPushArgs(branch: string, disableHelpers = false): string[] | null {
  if (!isSafeBranch(branch)) {
    return null;
  }
  const args = ['git'];
  if (disableHelpers) {
    args.push('-c', 'credential.helper=');
  }
  args.push('push', '--set-upstream', 'origin', branch);
  return args;
}
