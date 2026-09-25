import {
  DETECTED_FRAMEWORKS,
  DETECTED_LANGUAGES,
  DETECTED_PACKAGE_MANAGERS,
  DETECTED_TEST_FRAMEWORKS,
  LOCAL_EMBEDDING_DIMENSIONS,
  LOCAL_EMBEDDING_MODEL,
} from '@codepilot/types';
import type { Pool, PoolClient } from 'pg';

export interface StoredSearchCandidate {
  path: string;
  symbol: string | null;
  language: string | null;
  startLine: number;
  endLine: number;
  content: string;
  cosine: number;
}

export interface IndexWrite {
  files: Array<{
    path: string;
    language: string | null;
    byteSize: number;
    lineCount: number;
    contentSha256: string;
  }>;
  chunks: Array<{
    path: string;
    symbol: string | null;
    language: string | null;
    startLine: number;
    endLine: number;
    content: string;
    embedding: number[];
  }>;
  detection: {
    languages: string[];
    frameworks: string[];
    packageManagers: string[];
    testFrameworks: string[];
  };
  truncated: boolean;
  embeddingModel: string;
}

interface IdRow {
  id: string;
}

interface SearchRow {
  path: string;
  symbol: string | null;
  language: string | null;
  start_line: number;
  end_line: number;
  content: string;
  cosine: string | number;
}

export class PgIndexStore {
  constructor(private readonly pool: Pool) {}

  async replaceIndex(repositoryId: string, ownerId: string, build: IndexWrite): Promise<boolean> {
    if (build.embeddingModel !== LOCAL_EMBEDDING_MODEL) {
      throw new Error('Unexpected embedding model.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const owned = await client.query(
        `SELECT id FROM repositories WHERE id = $1 AND owner_id = $2 AND status = 'cloned' FOR UPDATE`,
        [repositoryId, ownerId],
      );
      if (owned.rowCount !== 1) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query('DELETE FROM repository_files WHERE repository_id = $1', [repositoryId]);
      const fileIds = new Map<string, string>();
      let storedChunks = 0;
      for (const file of build.files) {
        if (!isStorePath(file.path)) {
          continue;
        }
        const inserted = await client.query<IdRow>(
          `INSERT INTO repository_files (repository_id, path, language, byte_size, line_count, content_sha256)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            repositoryId,
            file.path,
            file.language,
            file.byteSize,
            file.lineCount,
            file.contentSha256,
          ],
        );
        const id = inserted.rows[0]?.id;
        if (id) {
          fileIds.set(file.path, id);
        }
      }
      for (const chunk of build.chunks) {
        const fileId = fileIds.get(chunk.path);
        if (!fileId || !isStorePath(chunk.path) || !isEmbedding(chunk.embedding)) {
          continue;
        }
        const inserted = await client.query<IdRow>(
          `INSERT INTO code_chunks (
             repository_id, file_id, symbol, language, start_line, end_line, content
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            repositoryId,
            fileId,
            chunk.symbol,
            chunk.language,
            chunk.startLine,
            chunk.endLine,
            chunk.content.slice(0, 4_000),
          ],
        );
        const chunkId = inserted.rows[0]?.id;
        if (!chunkId) {
          continue;
        }
        await client.query(
          `INSERT INTO embeddings (chunk_id, repository_id, model, dimensions, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)`,
          [
            chunkId,
            repositoryId,
            LOCAL_EMBEDDING_MODEL,
            LOCAL_EMBEDDING_DIMENSIONS,
            vectorLiteral(chunk.embedding),
          ],
        );
        storedChunks += 1;
      }
      await client.query(
        `UPDATE repositories
         SET indexing_status = 'completed',
             indexing_error = NULL,
             index_truncated = $3,
             indexed_at = now(),
             indexed_file_count = $4,
             indexed_chunk_count = $5,
             detected_languages = $6,
             detected_frameworks = $7,
             detected_package_managers = $8,
             detected_test_frameworks = $9,
             embedding_model = $10,
             updated_at = now()
         WHERE id = $1 AND owner_id = $2`,
        [
          repositoryId,
          ownerId,
          build.truncated,
          fileIds.size,
          storedChunks,
          JSON.stringify(keepKnown(build.detection.languages, DETECTED_LANGUAGES)),
          JSON.stringify(keepKnown(build.detection.frameworks, DETECTED_FRAMEWORKS)),
          JSON.stringify(keepKnown(build.detection.packageManagers, DETECTED_PACKAGE_MANAGERS)),
          JSON.stringify(keepKnown(build.detection.testFrameworks, DETECTED_TEST_FRAMEWORKS)),
          LOCAL_EMBEDDING_MODEL,
        ],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async searchCandidates(
    repositoryId: string,
    ownerId: string,
    embedding: number[],
    limit: number,
  ): Promise<StoredSearchCandidate[]> {
    if (!isEmbedding(embedding)) {
      return [];
    }
    const bounded = Math.min(40, Math.max(1, Math.floor(limit)));
    const result = await this.pool.query<SearchRow>(
      `SELECT f.path, c.symbol, c.language, c.start_line, c.end_line, c.content,
              1 - (e.embedding <=> $1::vector) AS cosine
       FROM code_chunks c
       JOIN repository_files f ON f.id = c.file_id
       JOIN embeddings e ON e.chunk_id = c.id
       JOIN repositories r ON r.id = c.repository_id
       WHERE c.repository_id = $2
         AND r.owner_id = $3
         AND r.indexing_status = 'completed'
         AND e.model = $4
       ORDER BY e.embedding <=> $1::vector
       LIMIT $5`,
      [vectorLiteral(embedding), repositoryId, ownerId, LOCAL_EMBEDDING_MODEL, bounded],
    );
    return result.rows.flatMap((row) => {
      const cosine = typeof row.cosine === 'number' ? row.cosine : Number(row.cosine);
      if (!Number.isFinite(cosine) || !isStorePath(row.path)) {
        return [];
      }
      return [
        {
          path: row.path,
          symbol: row.symbol,
          language: row.language,
          startLine: row.start_line,
          endLine: row.end_line,
          content: row.content,
          cosine,
        },
      ];
    });
  }
}

function vectorLiteral(values: number[]): string {
  return `[${values.map((value) => value.toFixed(8)).join(',')}]`;
}

function isEmbedding(values: number[]): boolean {
  return (
    values.length === LOCAL_EMBEDDING_DIMENSIONS && values.every((value) => Number.isFinite(value))
  );
}

function isStorePath(filePath: string): boolean {
  if (filePath.length === 0 || filePath.length > 300 || filePath.startsWith('/')) {
    return false;
  }
  if (filePath.includes('\\') || filePath.includes('\0')) {
    return false;
  }
  return filePath
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function keepKnown(values: readonly string[], allowed: readonly string[]): string[] {
  const allow = new Set<string>(allowed);
  return values.filter((value) => allow.has(value));
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // The connection is discarded by release.
  }
}
