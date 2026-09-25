import { mkdir, rm } from 'node:fs/promises';
import { embedLocal } from '@codepilot/ai';
import type {
  PgRepositoryStore,
  StoredRepository,
  StoredSearchCandidate,
} from '@codepilot/database';
import {
  GitHubAuthError,
  GitHubRequestError,
  getUserRepository,
  listUserRepositories,
  type GitHubRepositoryChoice,
} from '@codepilot/github';
import { rankChunks } from '@codepilot/indexing';
import { resolveWithinRoot } from '@codepilot/security';
import {
  DETECTED_FRAMEWORKS,
  DETECTED_LANGUAGES,
  DETECTED_PACKAGE_MANAGERS,
  DETECTED_TEST_FRAMEWORKS,
  INDEXING_STATUSES,
  LOCAL_EMBEDDING_MODEL,
  REPOSITORY_PERMISSIONS,
  type AvailableRepository,
  type CodeSearchResponse,
  type ImportedRepository,
  type IndexJob,
  type IndexingStatus,
  type RepositoryPermission,
} from '@codepilot/types';
import type { AuthService } from '../auth/auth.service';
import { CloneError, cloneRepository } from './clone-repository';

export class RepositoryFlowError extends Error {
  constructor(
    readonly reason:
      'not_connected' | 'unavailable' | 'not_found' | 'not_cloned' | 'queue_unavailable',
  ) {
    super(reason);
    this.name = 'RepositoryFlowError';
  }
}

export interface RepositoryServiceOptions {
  auth: Pick<AuthService, 'githubAccessToken'>;
  store: Pick<
    PgRepositoryStore,
    | 'listByOwner'
    | 'findForOwner'
    | 'upsertCloning'
    | 'markCloned'
    | 'markCloneFailed'
    | 'markIndexingQueued'
  >;
  storageDir: string;
  queue: { enqueue(job: IndexJob): Promise<void> };
  indexes: {
    searchCandidates(
      repositoryId: string,
      ownerId: string,
      embedding: number[],
      limit: number,
    ): Promise<StoredSearchCandidate[]>;
  };
  github?: {
    list: (token: string) => Promise<GitHubRepositoryChoice[]>;
    get: (token: string, fullName: string) => Promise<GitHubRepositoryChoice | null>;
  };
  clone?: (input: {
    fullName: string;
    branch: string;
    destination: string;
    token: string;
  }) => Promise<void>;
}

export class RepositoryService {
  private readonly clonesInFlight = new Map<string, Promise<ImportedRepository>>();

  constructor(private readonly options: RepositoryServiceOptions) {}

  async list(ownerId: string): Promise<ImportedRepository[]> {
    const rows = await this.options.store.listByOwner(ownerId);
    return rows.map(toImportedRepository);
  }

  async available(ownerId: string): Promise<AvailableRepository[]> {
    const token = await this.token(ownerId);
    try {
      const rows = await this.catalog().list(token);
      return rows.map(toAvailableRepository);
    } catch (error) {
      throw githubFailure(error);
    }
  }

  async requestIndex(ownerId: string, id: string): Promise<ImportedRepository> {
    const row = await this.options.store.findForOwner(id, ownerId);
    if (!row) {
      throw new RepositoryFlowError('not_found');
    }
    if (row.status !== 'cloned') {
      throw new RepositoryFlowError('not_cloned');
    }
    try {
      await this.options.queue.enqueue({ repositoryId: id, ownerId });
    } catch (error) {
      if (error instanceof RepositoryFlowError) {
        throw error;
      }
      throw new RepositoryFlowError('queue_unavailable');
    }
    const queued = await this.options.store.markIndexingQueued(id, ownerId);
    return toImportedRepository(
      queued ?? { ...row, indexingStatus: 'queued', indexingError: null },
    );
  }

  async search(ownerId: string, id: string, query: string): Promise<CodeSearchResponse> {
    const row = await this.options.store.findForOwner(id, ownerId);
    if (!row) {
      throw new RepositoryFlowError('not_found');
    }
    if (row.indexingStatus !== 'completed') {
      return { indexing: knownIndexing(row.indexingStatus), hits: [] };
    }
    const candidates = await this.options.indexes.searchCandidates(
      id,
      ownerId,
      embedLocal(query),
      40,
    );
    return { indexing: 'completed', hits: rankChunks(query, candidates) };
  }

  async get(ownerId: string, id: string): Promise<ImportedRepository> {
    const row = await this.options.store.findForOwner(id, ownerId);
    if (!row) {
      throw new RepositoryFlowError('not_found');
    }
    return toImportedRepository(row);
  }

  async importRepository(ownerId: string, fullName: string): Promise<ImportedRepository> {
    const key = `${ownerId}:${fullName}`;
    const current = this.clonesInFlight.get(key);
    if (current) {
      return current;
    }
    const run = this.importOnce(ownerId, fullName).finally(() => {
      this.clonesInFlight.delete(key);
    });
    this.clonesInFlight.set(key, run);
    return run;
  }

  private async importOnce(ownerId: string, fullName: string): Promise<ImportedRepository> {
    const token = await this.token(ownerId);
    let choice: GitHubRepositoryChoice | null;
    try {
      choice = await this.catalog().get(token, fullName);
    } catch (error) {
      throw githubFailure(error);
    }
    if (!choice) {
      throw new RepositoryFlowError('not_found');
    }

    const stored = await this.options.store.upsertCloning(ownerId, choice);
    const destination = resolveWithinRoot(this.options.storageDir, `${ownerId}/${stored.id}`);
    await rm(destination, { recursive: true, force: true });
    await mkdir(this.options.storageDir, { recursive: true });
    await mkdir(destination, { recursive: true });

    try {
      await this.cloner()({
        fullName: choice.fullName,
        branch: choice.defaultBranch,
        destination,
        token: choice.private ? token : '',
      });
    } catch (error) {
      const failed = await this.options.store.markCloneFailed(
        stored.id,
        ownerId,
        cloneMessage(error),
      );
      return toImportedRepository(
        failed ?? { ...stored, status: 'clone_failed', cloneError: cloneMessage(error) },
      );
    }

    const cloned = await this.options.store.markCloned(stored.id, ownerId);
    return toImportedRepository(cloned ?? { ...stored, status: 'cloned', cloneError: null });
  }

  private async token(ownerId: string): Promise<string> {
    try {
      const token = await this.options.auth.githubAccessToken(ownerId);
      if (!token) {
        throw new RepositoryFlowError('not_connected');
      }
      return token;
    } catch (error) {
      if (error instanceof RepositoryFlowError) {
        throw error;
      }
      throw new RepositoryFlowError('unavailable');
    }
  }

  private catalog(): NonNullable<RepositoryServiceOptions['github']> {
    return (
      this.options.github ?? {
        list: listUserRepositories,
        get: getUserRepository,
      }
    );
  }

  private cloner(): NonNullable<RepositoryServiceOptions['clone']> {
    return this.options.clone ?? cloneRepository;
  }
}

export function toImportedRepository(row: StoredRepository): ImportedRepository {
  return {
    ...toAvailableRepository(row),
    id: row.id,
    status: row.status,
    cloneError: row.cloneError,
    indexing: knownIndexing(row.indexingStatus),
    indexingError: row.indexingError,
    indexTruncated: row.indexTruncated,
    indexedAt: row.indexedAt ? row.indexedAt.toISOString() : null,
    fileCount: row.indexedFileCount,
    chunkCount: row.indexedChunkCount,
    detectedLanguages: knownLabels(row.detectedLanguages, DETECTED_LANGUAGES),
    detectedFrameworks: knownLabels(row.detectedFrameworks, DETECTED_FRAMEWORKS),
    detectedPackageManagers: knownLabels(row.detectedPackageManagers, DETECTED_PACKAGE_MANAGERS),
    detectedTestFrameworks: knownLabels(row.detectedTestFrameworks, DETECTED_TEST_FRAMEWORKS),
    embeddingModel: row.embeddingModel === LOCAL_EMBEDDING_MODEL ? row.embeddingModel : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAvailableRepository(row: {
  githubRepoId: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  language: string | null;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  permission: string;
}): AvailableRepository {
  return {
    githubRepoId: row.githubRepoId,
    name: row.name,
    fullName: row.fullName,
    defaultBranch: row.defaultBranch,
    language: row.language,
    description: row.description,
    private: row.private,
    htmlUrl: row.htmlUrl,
    permission: knownPermission(row.permission),
  };
}

function knownIndexing(value: string): IndexingStatus {
  return INDEXING_STATUSES.find((status) => status === value) ?? 'not_started';
}

function knownLabels(values: readonly string[], allowed: readonly string[]): string[] {
  const allow = new Set<string>(allowed);
  return values.filter((value) => allow.has(value));
}

function knownPermission(value: string): RepositoryPermission {
  return REPOSITORY_PERMISSIONS.find((permission) => permission === value) ?? 'read';
}

function githubFailure(error: unknown): RepositoryFlowError {
  if (error instanceof GitHubAuthError) {
    return new RepositoryFlowError('not_connected');
  }
  if (error instanceof GitHubRequestError) {
    return new RepositoryFlowError('unavailable');
  }
  return new RepositoryFlowError('unavailable');
}

function cloneMessage(error: unknown): string {
  if (error instanceof CloneError && error.reason === 'git_missing') {
    return 'Git is not available on the server.';
  }
  if (error instanceof CloneError && error.reason === 'timeout') {
    return 'The clone timed out.';
  }
  return 'The repository could not be cloned.';
}
