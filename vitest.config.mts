import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/dist/**', '**/.next/**', '**/node_modules/**'],
  },
  resolve: {
    alias: {
      '@codepilot/types': path.join(root, 'packages/types/src/index.ts'),
      '@codepilot/config': path.join(root, 'packages/config/src/index.ts'),
      '@codepilot/database': path.join(root, 'packages/database/src/index.ts'),
      '@codepilot/logger': path.join(root, 'packages/logger/src/index.ts'),
      '@codepilot/security': path.join(root, 'packages/security/src/index.ts'),
      '@codepilot/ai': path.join(root, 'packages/ai/src/index.ts'),
      '@codepilot/indexing': path.join(root, 'packages/indexing/src/index.ts'),
      '@codepilot/github': path.join(root, 'packages/github/src/index.ts'),
      '@codepilot/tools': path.join(root, 'packages/tools/src/index.ts'),
    },
  },
});
