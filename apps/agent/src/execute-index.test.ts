import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { StoredRepository } from '@codepilot/database';
import { afterEach, describe, expect, it } from 'vitest';
import { executeIndexJob, INDEX_MISSING_MESSAGE } from './execute-index';

const ownerId = '11111111-1111-4111-8111-111111111111';
const repositoryId = '22222222-2222-4222-8222-222222222222';

describe('executeIndexJob', () => {
  const directories: string[] = [];

  afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await Promise.all(
      directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('indexes the clone and leaves secret files out of the stored chunks', async () => {
    const storageDir = await mkdtemp(path.join(tmpdir(), 'codepilot-worker-'));
    directories.push(storageDir);
    const root = path.join(storageDir, ownerId, repositoryId);
    await mkdir(path.join(root, 'src'), { recursive: true });
    await writeFile(
      path.join(root, 'src', 'auth.ts'),
      'export function loginUser() {\n  return true;\n}\n',
    );
    await writeFile(path.join(root, '.env'), 'SECRET_TOKEN=super-secret-value\n');
    let storedChunks = '';
    const status: string[] = [];

    const result = await executeIndexJob({
      repositoryId,
      ownerId,
      storageDir,
      store: {
        findForOwner: () => Promise.resolve(repository('cloned')),
        markIndexingRunning: () => {
          status.push('running');
          return Promise.resolve(repository('cloned', 'running'));
        },
        markIndexingFailed: (_id, _owner, message) => {
          status.push(message);
          return Promise.resolve(repository('cloned', 'failed'));
        },
        replaceIndex: (_id, _owner, build) => {
          storedChunks = JSON.stringify(build.chunks);
          return Promise.resolve(true);
        },
      },
    });

    expect(result).toBe('completed');
    expect(status).toEqual(['running']);
    expect(storedChunks).toContain('loginUser');
    expect(storedChunks).not.toContain('super-secret-value');
  });

  it('records a fixed message when the clone directory is missing', async () => {
    const storageDir = await mkdtemp(path.join(tmpdir(), 'codepilot-worker-'));
    directories.push(storageDir);
    const messages: string[] = [];
    const result = await executeIndexJob({
      repositoryId,
      ownerId,
      storageDir,
      store: {
        findForOwner: () => Promise.resolve(repository('cloned')),
        markIndexingRunning: () => Promise.resolve(repository('cloned', 'running')),
        markIndexingFailed: (_id, _owner, message) => {
          messages.push(message);
          return Promise.resolve(repository('cloned', 'failed'));
        },
        replaceIndex: () => Promise.resolve(true),
      },
    });
    expect(result).toBe('failed');
    expect(messages).toEqual([INDEX_MISSING_MESSAGE]);
  });
});

function repository(
  status: StoredRepository['status'],
  indexingStatus: StoredRepository['indexingStatus'] = 'queued',
): StoredRepository {
  return {
    id: repositoryId,
    ownerId,
    githubRepoId: '42',
    name: 'hello',
    fullName: 'octocat/hello',
    defaultBranch: 'main',
    language: 'TypeScript',
    description: null,
    private: false,
    htmlUrl: 'https://github.com/octocat/hello',
    permission: 'write',
    status,
    cloneError: null,
    indexingStatus,
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
}
