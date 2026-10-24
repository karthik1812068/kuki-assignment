import type { Pool } from 'pg';

export interface DocumentWrite {
  ownerId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
  kind: string;
  status: string;
  duplicateOf: string | null;
}

export interface StoredDocument {
  id: string;
  ownerId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
  kind: string;
  status: string;
  error: string | null;
  duplicateOf: string | null;
  extraction: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

interface DocumentRow {
  id: string;
  owner_id: string;
  filename: string;
  content_type: string;
  byte_size: number;
  sha256: string;
  storage_key: string;
  kind: string;
  status: string;
  error: string | null;
  duplicate_of: string | null;
  extraction: string;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

export class PgDocumentStore {
  constructor(private readonly pool: Pool) {}

  async create(write: DocumentWrite): Promise<StoredDocument> {
    const result = await this.pool.query<DocumentRow>(
      `INSERT INTO documents (
         owner_id, filename, content_type, byte_size, sha256, storage_key, kind, status, duplicate_of
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${DOCUMENT_COLUMNS}`,
      [
        write.ownerId,
        write.filename,
        write.contentType,
        write.byteSize,
        write.sha256,
        write.storageKey,
        write.kind,
        write.status,
        write.duplicateOf,
      ],
    );
    return mapDocument(result.rows[0]);
  }

  async listForOwner(ownerId: string): Promise<StoredDocument[]> {
    const result = await this.pool.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [ownerId],
    );
    return result.rows.map(mapDocument);
  }

  async findForOwner(id: string, ownerId: string): Promise<StoredDocument | null> {
    const result = await this.pool.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE id = $1 AND owner_id = $2 LIMIT 1`,
      [id, ownerId],
    );
    return result.rows[0] ? mapDocument(result.rows[0]) : null;
  }

  async findByHash(ownerId: string, sha256: string): Promise<StoredDocument | null> {
    const result = await this.pool.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS}
       FROM documents
       WHERE owner_id = $1 AND sha256 = $2 AND status <> 'failed'
       ORDER BY created_at ASC
       LIMIT 1`,
      [ownerId, sha256],
    );
    return result.rows[0] ? mapDocument(result.rows[0]) : null;
  }

  async setStorageKey(id: string, ownerId: string, storageKey: string): Promise<void> {
    await this.pool.query(
      `UPDATE documents SET storage_key = $3, updated_at = now() WHERE id = $1 AND owner_id = $2`,
      [id, ownerId, storageKey],
    );
  }

  async markFailedQueue(id: string, ownerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE documents
       SET status = 'failed',
           error = 'The document could not be queued.',
           completed_at = now(),
           updated_at = now()
       WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
  }

  async claim(id: string, ownerId: string): Promise<StoredDocument | null> {
    const result = await this.pool.query<DocumentRow>(
      `UPDATE documents
       SET status = 'processing', started_at = COALESCE(started_at, now()), updated_at = now(), error = NULL
       WHERE id = $1 AND owner_id = $2 AND status = 'queued'
       RETURNING ${DOCUMENT_COLUMNS}`,
      [id, ownerId],
    );
    return result.rows[0] ? mapDocument(result.rows[0]) : null;
  }

  async complete(id: string, ownerId: string, extraction: unknown, kind: string): Promise<void> {
    await this.pool.query(
      `UPDATE documents
       SET status = 'completed',
           kind = $3,
           extraction = $4,
           error = NULL,
           completed_at = now(),
           updated_at = now()
       WHERE id = $1 AND owner_id = $2`,
      [id, ownerId, kind, JSON.stringify(extraction)],
    );
  }

  async fail(id: string, ownerId: string, message: string): Promise<void> {
    await this.pool.query(
      `UPDATE documents
       SET status = 'failed', error = $3, completed_at = now(), updated_at = now()
       WHERE id = $1 AND owner_id = $2`,
      [id, ownerId, message.slice(0, 300)],
    );
  }
}

const DOCUMENT_COLUMNS = `id, owner_id, filename, content_type, byte_size, sha256, storage_key,
  kind, status, error, duplicate_of, extraction, started_at, completed_at, created_at`;

function mapDocument(row: DocumentRow | undefined): StoredDocument {
  if (!row) {
    throw new Error('Document row was missing.');
  }
  let extraction: unknown;
  try {
    extraction = JSON.parse(row.extraction);
  } catch {
    extraction = {};
  }
  return {
    id: row.id,
    ownerId: row.owner_id,
    filename: row.filename,
    contentType: row.content_type,
    byteSize: row.byte_size,
    sha256: row.sha256,
    storageKey: row.storage_key,
    kind: row.kind,
    status: row.status,
    error: row.error,
    duplicateOf: row.duplicate_of,
    extraction,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}
