import path from 'node:path';
import type { FoundationEnv } from './env';
import { findRepoRoot } from './repo-root';

export function repositoryStorageDir(
  env: Pick<FoundationEnv, 'REPOSITORIES_DIR'>,
  start = process.cwd(),
): string {
  if (env.REPOSITORIES_DIR) {
    return env.REPOSITORIES_DIR;
  }
  return path.join(findRepoRoot(start), 'data', 'repositories');
}
