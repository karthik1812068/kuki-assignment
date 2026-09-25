import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { GitHubRepositoryChoice } from '@codepilot/github';
import type { StoredRepository } from '@codepilot/database';
import { afterEach, describe, expect, it } from 'vitest';
import { RepositoryFlowError, RepositoryService } from './repository.service';

const choice: GitHubRepositoryChoice = {
  githubRepoId: '42',
  name: 'hello',
  fullName: 'octocat/hello',
  defaultBranch: 'main',
  language: 'TypeScript',
  description: 'A sample',
  private: false,
  htmlUrl: 'https://github.com/octocat/hello',
  permission: 'write',
};

describe('RepositoryService', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('imports a repository the account can access and does not return the token', async () => {
    const storageDir = await mkdtemp(path.join(tmpdir(), 'codepilot-repos-'));
    directories.push(storageDir);
    let clonedToken = '';
    const service = new RepositoryService({
      storageDir,
      auth: { githubAccessToken: () => Promise.resolve('gho_secret_token') },
      github: {
        list: () => Promise.resolve([choice]),
        get: () => Promise.resolve(choice),
      },
      clone: (input) => {
        clonedToken = input.token;
        return Promise.resolve();
      },
      store: memoryStore(),
      queue: { enqueue: () => Promise.resolve() },
      indexes: { searchCandidates: () => Promise.resolve([]) },
    });

    const imported = await service.importRepository(
      '11111111-1111-4111-8111-111111111111',
      'octocat/hello',
    );

    expect(imported.status).toBe('cloned');
    expect(imported.indexing).toBe('not_started');
    expect(imported.embeddingModel).toBeNull();
    expect(imported.fullName).toBe('octocat/hello');
    expect(JSON.stringify(imported)).not.toContain('gho_secret_token');
    expect(clonedToken).toBe('');
    expect(await service.list('11111111-1111-4111-8111-111111111111')).toHaveLength(1);
  });

  it('passes the GitHub token only when the repository is private', async () => {
    let clonedToken = '';
    const service = new RepositoryService({
      storageDir: tmpdir(),
      auth: { githubAccessToken: () => Promise.resolve('gho_secret_token') },
      github: {
        list: () => Promise.resolve([{ ...choice, private: true }]),
        get: () => Promise.resolve({ ...choice, private: true }),
      },
      clone: (input) => {
        clonedToken = input.token;
        return Promise.resolve();
      },
      store: memoryStore(),
      queue: { enqueue: () => Promise.resolve() },
      indexes: { searchCandidates: () => Promise.resolve([]) },
    });

    await service.importRepository('11111111-1111-4111-8111-111111111111', 'octocat/hello');
    expect(clonedToken).toBe('gho_secret_token');
  });

  it('does not clone a repository GitHub does not return', async () => {
    const service = new RepositoryService({
      storageDir: tmpdir(),
      auth: { githubAccessToken: () => Promise.resolve('gho_secret_token') },
      github: { list: () => Promise.resolve([]), get: () => Promise.resolve(null) },
      clone: () => Promise.reject(new Error('should not clone')),
      store: memoryStore(),
      queue: { enqueue: () => Promise.resolve() },
      indexes: { searchCandidates: () => Promise.resolve([]) },
    });

    await expect(
      service.importRepository('11111111-1111-4111-8111-111111111111', 'octocat/missing'),
    ).rejects.toBeInstanceOf(RepositoryFlowError);
  });

  it('queues indexing only after a clone and does not put the token on the job', async () => {
    const jobs: string[] = [];
    const store = memoryStore();
    const service = new RepositoryService({
      storageDir: tmpdir(),
      auth: { githubAccessToken: () => Promise.resolve('gho_secret_token') },
      github: { list: () => Promise.resolve([choice]), get: () => Promise.resolve(choice) },
      clone: () => Promise.resolve(),
      store,
      queue: {
        enqueue: (job) => {
          jobs.push(JSON.stringify(job));
          return Promise.resolve();
        },
      },
      indexes: { searchCandidates: () => Promise.resolve([]) },
    });

    await service.importRepository('11111111-1111-4111-8111-111111111111', 'octocat/hello');
    const queued = await service.requestIndex(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    );

    expect(queued.indexing).toBe('queued');
    expect(jobs).toEqual([
      JSON.stringify({
        repositoryId: '22222222-2222-4222-8222-222222222222',
        ownerId: '11111111-1111-4111-8111-111111111111',
      }),
    ]);
    expect(jobs[0]).not.toContain('gho_secret_token');
  });
});

function memoryStore() {
  const rows = new Map<string, StoredRepository>();
  return {
    listByOwner: (ownerId: string) =>
      Promise.resolve([...rows.values()].filter((row) => row.ownerId === ownerId)),
    findForOwner: (id: string, ownerId: string) =>
      Promise.resolve(rows.get(id)?.ownerId === ownerId ? rows.get(id)! : null),
    upsertCloning: (ownerId: string, input: GitHubRepositoryChoice) => {
      const row: StoredRepository = {
        ...input,
        id: '22222222-2222-4222-8222-222222222222',
        ownerId,
        status: 'cloning',
        cloneError: null,
        indexingStatus: 'not_started',
        indexingError: null,
        indexTruncated: false,
        indexedAt: null,
        indexedFileCount: null,
        indexedChunkCount: null,
        detectedLanguages: [],
        detectedFrameworks: [],
        detectedPackageManagers: [],
        detectedTestFrameworks: [],
        embeddingModel: null,
        createdAt: new Date('2026-09-24T00:00:00.000Z'),
        updatedAt: new Date('2026-09-24T00:00:00.000Z'),
      };
      rows.set(row.id, row);
      return Promise.resolve(row);
    },
    markCloned: (id: string, ownerId: string) => {
      const row = rows.get(id);
      if (!row || row.ownerId !== ownerId) {
        return Promise.resolve(null);
      }
      const next = {
        ...row,
        status: 'cloned' as const,
        cloneError: null,
        indexingStatus: 'not_started' as const,
        indexingError: null,
        indexTruncated: false,
        indexedAt: null,
      };
      rows.set(id, next);
      return Promise.resolve(next);
    },
    markCloneFailed: (id: string, ownerId: string, cloneError: string) => {
      const row = rows.get(id);
      if (!row || row.ownerId !== ownerId) {
        return Promise.resolve(null);
      }
      const next = { ...row, status: 'clone_failed' as const, cloneError };
      rows.set(id, next);
      return Promise.resolve(next);
    },
    markIndexingQueued: (id: string, ownerId: string) => {
      const row = rows.get(id);
      if (!row || row.ownerId !== ownerId || row.status !== 'cloned') {
        return Promise.resolve(null);
      }
      const next = { ...row, indexingStatus: 'queued' as const, indexingError: null };
      rows.set(id, next);
      return Promise.resolve(next);
    },
  };
}
