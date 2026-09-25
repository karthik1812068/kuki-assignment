import { describe, expect, it } from 'vitest';
import { parseImportedRepository } from './parse-repository';

describe('parseImportedRepository', () => {
  it('keeps public repository fields and drops a token or filesystem path', () => {
    const repository = parseImportedRepository({
      id: '22222222-2222-4222-8222-222222222222',
      githubRepoId: '42',
      name: 'hello',
      fullName: 'octocat/hello',
      defaultBranch: 'main',
      language: 'TypeScript',
      description: null,
      private: false,
      htmlUrl: 'https://github.com/octocat/hello',
      permission: 'write',
      status: 'cloned',
      cloneError: null,
      indexing: 'completed',
      indexingError: null,
      indexTruncated: false,
      indexedAt: '2026-09-24T00:00:00.000Z',
      fileCount: 1,
      chunkCount: 1,
      detectedLanguages: ['TypeScript'],
      detectedFrameworks: [],
      detectedPackageManagers: ['npm'],
      detectedTestFrameworks: [],
      embeddingModel: 'local-hash-v1',
      createdAt: '2026-09-24T00:00:00.000Z',
      updatedAt: '2026-09-24T00:00:00.000Z',
      accessToken: 'gho_secret_token',
      clonePath: 'D:\\secrets\\repo',
    });

    expect(repository?.fullName).toBe('octocat/hello');
    expect(repository?.indexing).toBe('completed');
    expect(repository?.embeddingModel).toBe('local-hash-v1');
    expect(repository).not.toHaveProperty('accessToken');
    expect(repository).not.toHaveProperty('clonePath');
    expect(JSON.stringify(repository)).not.toContain('gho_secret_token');
  });
});
