import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@codepilot/config': path.join(root, 'packages/config/src/index.ts'),
      '@codepilot/database': path.join(root, 'packages/database/src/index.ts'),
      '@codepilot/logger': path.join(root, 'packages/logger/src/index.ts'),
      '@codepilot/security': path.join(root, 'packages/security/src/index.ts'),
    },
  },
});
