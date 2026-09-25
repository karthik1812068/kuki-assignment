import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';

const ROOT_PACKAGE_NAME = 'codepilot-ai';

export function findRepoRoot(start: string): string {
  let current = start;

  while (true) {
    const manifestPath = join(current, 'package.json');
    if (existsSync(manifestPath)) {
      try {
        const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: string };
        if (parsed.name === ROOT_PACKAGE_NAME) {
          return current;
        }
      } catch {
        // Keep walking when a package.json cannot be read.
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error('Could not locate the codepilot-ai repository root.');
    }
    current = parent;
  }
}

export function loadRepoEnv(start = process.cwd()): void {
  const root = findRepoRoot(start);
  loadDotenv({ path: join(root, '.env') });
}
