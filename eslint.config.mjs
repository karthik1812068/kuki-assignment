import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.mjs',
      'apps/web/next-env.d.ts',
      '**/drizzle.config.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'child_process',
              message:
                'Run commands only inside the Docker sandbox. This build has no command runner.',
            },
            {
              name: 'node:child_process',
              message:
                'Run commands only inside the Docker sandbox. This build has no command runner.',
            },
          ],
        },
      ],
    },
  },
);
