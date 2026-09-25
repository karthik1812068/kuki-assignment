import { and, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { repositories } from './schema';

export interface RepositoryWrite {
  githubRepoId: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  language: string | null;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  permission: string;
}

export type IndexingStatus = 'not_started' | 'queued' | 'running' | 'completed' | 'failed';

export interface StoredRepository extends RepositoryWrite {
  id: string;
  ownerId: string;
  status: 'cloning' | 'cloned' | 'clone_failed';
  cloneError: string | null;
  indexingStatus: IndexingStatus;
  indexingError: string | null;
  indexTruncated: boolean;
  indexedAt: Date | null;
  indexedFileCount: number | null;
  indexedChunkCount: number | null;
  detectedLanguages: string[];
  detectedFrameworks: string[];
  detectedPackageManagers: string[];
  detectedTestFrameworks: string[];
  embeddingModel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PgRepositoryStore {
  private readonly db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  async listByOwner(ownerId: string): Promise<StoredRepository[]> {
    const rows = await this.db
      .select()
      .from(repositories)
      .where(eq(repositories.ownerId, ownerId))
      .orderBy(desc(repositories.updatedAt));
    return rows.map(mapRepository);
  }

  async findForOwner(id: string, ownerId: string): Promise<StoredRepository | null> {
    const rows = await this.db
      .select()
      .from(repositories)
      .where(and(eq(repositories.id, id), eq(repositories.ownerId, ownerId)))
      .limit(1);
    const row = rows[0];
    return row ? mapRepository(row) : null;
  }

  async upsertCloning(ownerId: string, input: RepositoryWrite): Promise<StoredRepository> {
    const now = new Date();
    const rows = await this.db
      .insert(repositories)
      .values({
        ownerId,
        githubRepoId: BigInt(input.githubRepoId),
        name: input.name,
        fullName: input.fullName,
        defaultBranch: input.defaultBranch,
        language: input.language,
        description: input.description,
        private: input.private,
        htmlUrl: input.htmlUrl,
        permission: input.permission,
        status: 'cloning',
        cloneError: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [repositories.ownerId, repositories.githubRepoId],
        set: {
          name: input.name,
          fullName: input.fullName,
          defaultBranch: input.defaultBranch,
          language: input.language,
          description: input.description,
          private: input.private,
          htmlUrl: input.htmlUrl,
          permission: input.permission,
          status: 'cloning',
          cloneError: null,
          ...clearedIndex(),
          updatedAt: now,
        },
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('Repository was not saved.');
    }
    await this.clearIndexedFiles(row.id);
    return mapRepository(row);
  }

  async markCloned(id: string, ownerId: string): Promise<StoredRepository | null> {
    const rows = await this.db
      .update(repositories)
      .set({ status: 'cloned', cloneError: null, ...clearedIndex(), updatedAt: new Date() })
      .where(and(eq(repositories.id, id), eq(repositories.ownerId, ownerId)))
      .returning();
    const row = rows[0];
    if (row) {
      await this.clearIndexedFiles(row.id);
    }
    return row ? mapRepository(row) : null;
  }

  async markIndexingQueued(id: string, ownerId: string): Promise<StoredRepository | null> {
    return this.markIndexing(id, ownerId, { indexingStatus: 'queued', indexingError: null });
  }

  async markIndexingRunning(id: string, ownerId: string): Promise<StoredRepository | null> {
    return this.markIndexing(id, ownerId, { indexingStatus: 'running', indexingError: null });
  }

  async markIndexingFailed(
    id: string,
    ownerId: string,
    indexingError: string,
  ): Promise<StoredRepository | null> {
    return this.markIndexing(id, ownerId, { indexingStatus: 'failed', indexingError });
  }

  async markCloneFailed(
    id: string,
    ownerId: string,
    cloneError: string,
  ): Promise<StoredRepository | null> {
    const rows = await this.db
      .update(repositories)
      .set({ status: 'clone_failed', cloneError, updatedAt: new Date() })
      .where(and(eq(repositories.id, id), eq(repositories.ownerId, ownerId)))
      .returning();
    const row = rows[0];
    return row ? mapRepository(row) : null;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(repositories).where(eq(repositories.id, id));
  }

  private async markIndexing(
    id: string,
    ownerId: string,
    patch: { indexingStatus: IndexingStatus; indexingError: string | null },
  ): Promise<StoredRepository | null> {
    const rows = await this.db
      .update(repositories)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(repositories.id, id),
          eq(repositories.ownerId, ownerId),
          eq(repositories.status, 'cloned'),
        ),
      )
      .returning();
    const row = rows[0];
    return row ? mapRepository(row) : null;
  }

  private async clearIndexedFiles(repositoryId: string): Promise<void> {
    await this.db.execute(sql`DELETE FROM repository_files WHERE repository_id = ${repositoryId}`);
  }
}

function mapRepository(row: typeof repositories.$inferSelect): StoredRepository {
  return {
    id: row.id,
    ownerId: row.ownerId,
    githubRepoId: row.githubRepoId.toString(),
    name: row.name,
    fullName: row.fullName,
    defaultBranch: row.defaultBranch,
    language: row.language,
    description: row.description,
    private: row.private,
    htmlUrl: row.htmlUrl,
    permission: row.permission,
    status: row.status as StoredRepository['status'],
    cloneError: row.cloneError,
    indexingStatus: row.indexingStatus as IndexingStatus,
    indexingError: row.indexingError,
    indexTruncated: row.indexTruncated,
    indexedAt: row.indexedAt,
    indexedFileCount: row.indexedFileCount,
    indexedChunkCount: row.indexedChunkCount,
    detectedLanguages: readStringList(row.detectedLanguages),
    detectedFrameworks: readStringList(row.detectedFrameworks),
    detectedPackageManagers: readStringList(row.detectedPackageManagers),
    detectedTestFrameworks: readStringList(row.detectedTestFrameworks),
    embeddingModel: row.embeddingModel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function clearedIndex(): {
  indexingStatus: 'not_started';
  indexingError: null;
  indexTruncated: false;
  indexedAt: null;
  indexedFileCount: null;
  indexedChunkCount: null;
  detectedLanguages: null;
  detectedFrameworks: null;
  detectedPackageManagers: null;
  detectedTestFrameworks: null;
  embeddingModel: null;
} {
  return {
    indexingStatus: 'not_started',
    indexingError: null,
    indexTruncated: false,
    indexedAt: null,
    indexedFileCount: null,
    indexedChunkCount: null,
    detectedLanguages: null,
    detectedFrameworks: null,
    detectedPackageManagers: null,
    detectedTestFrameworks: null,
    embeddingModel: null,
  };
}

function readStringList(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}
