import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Redis } from 'ioredis';
import { answerQuestion, classifyKind, type DocumentExtraction } from '@codepilot/indexing';
import { enqueueDocumentJob, type PgDocumentStore, type StoredDocument } from '@codepilot/database';
import { resolveWithinRoot } from '@codepilot/security';

const MAX_FILES = 12;
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(['pdf', 'xlsx', 'xls', 'csv', 'txt', 'md', 'json']);

export class DocumentFlowError extends Error {
  override readonly name = 'DocumentFlowError';

  constructor(readonly reason: 'invalid' | 'queue_unavailable' | 'not_found') {
    super(reason);
  }
}

export interface UploadedDocument {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class DocumentService {
  constructor(
    private readonly documents: PgDocumentStore,
    private readonly redis: Redis,
    private readonly storageDir: string,
  ) {}

  async upload(ownerId: string, files: UploadedDocument[]): Promise<StoredDocument[]> {
    if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES) {
      throw new DocumentFlowError('invalid');
    }
    const saved: StoredDocument[] = [];
    for (const file of files) {
      saved.push(await this.acceptOne(ownerId, file));
    }
    return saved;
  }

  async list(ownerId: string): Promise<StoredDocument[]> {
    return this.documents.listForOwner(ownerId);
  }

  async details(ownerId: string, id: string): Promise<StoredDocument> {
    const found = await this.documents.findForOwner(id, ownerId);
    if (!found) {
      throw new DocumentFlowError('not_found');
    }
    return found;
  }

  async ask(ownerId: string, question: string) {
    const cleaned = question.trim().slice(0, 400);
    if (cleaned.length < 3) {
      throw new DocumentFlowError('invalid');
    }
    const rows = (await this.documents.listForOwner(ownerId)).filter(
      (row) => row.status === 'completed',
    );
    const corpus: DocumentExtraction[] = rows.map((row) =>
      asExtraction(row.filename, row.extraction),
    );
    return answerQuestion(cleaned, corpus, 'improved');
  }

  private async acceptOne(ownerId: string, file: UploadedDocument): Promise<StoredDocument> {
    const filename = safeFilename(file.originalname);
    const extension = extensionOf(filename);
    if (
      !filename ||
      !ALLOWED.has(extension) ||
      file.size <= 0 ||
      file.size > MAX_BYTES ||
      !file.buffer
    ) {
      return this.reject(ownerId, filename || 'rejected', file);
    }
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.documents.findByHash(ownerId, sha256);
    if (existing) {
      return this.documents.create({
        ownerId,
        filename,
        contentType: safeType(file.mimetype),
        byteSize: file.size,
        sha256,
        storageKey: existing.storageKey,
        kind: existing.kind,
        status: 'duplicate',
        duplicateOf: existing.id,
      });
    }
    const draft = await this.documents.create({
      ownerId,
      filename,
      contentType: safeType(file.mimetype),
      byteSize: file.size,
      sha256,
      storageKey: `${ownerId}/pending/${filename}`,
      kind: classifyKind(filename),
      status: 'queued',
      duplicateOf: null,
    });
    const storageKey = `${ownerId}/${draft.id}/${filename}`;
    const destination = resolveWithinRoot(this.storageDir, storageKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.buffer);
    await this.documents.setStorageKey(draft.id, ownerId, storageKey);
    try {
      await enqueueDocumentJob(this.redis, { documentId: draft.id, ownerId });
    } catch {
      await this.documents.markFailedQueue(draft.id, ownerId);
      return {
        ...draft,
        storageKey,
        status: 'failed',
        error: 'The document could not be queued.',
      };
    }
    return { ...draft, storageKey };
  }

  private async reject(
    ownerId: string,
    filename: string,
    file: UploadedDocument,
  ): Promise<StoredDocument> {
    const message = 'This file was rejected. Other files in the same upload were not stopped.';
    const row = await this.documents.create({
      ownerId,
      filename,
      contentType: safeType(file.mimetype),
      byteSize: Math.max(0, file.size),
      sha256: createHash('sha256').update(`rejected:${filename}:${file.size}`).digest('hex'),
      storageKey: 'rejected',
      kind: classifyKind(filename),
      status: 'queued',
      duplicateOf: null,
    });
    await this.documents.fail(row.id, ownerId, message);
    return { ...row, status: 'failed', error: message };
  }
}

function asExtraction(filename: string, value: unknown): DocumentExtraction {
  if (!value || typeof value !== 'object') {
    return { kind: 'unknown', filename, facts: [], financialYears: [], excerpt: '' };
  }
  const record = value as DocumentExtraction;
  return {
    kind: record.kind ?? 'unknown',
    filename: typeof record.filename === 'string' ? record.filename : filename,
    facts: Array.isArray(record.facts) ? record.facts : [],
    financialYears: Array.isArray(record.financialYears) ? record.financialYears : [],
    excerpt: typeof record.excerpt === 'string' ? record.excerpt : '',
  };
}

function safeFilename(value: string): string {
  const base = value.replaceAll('\\', '/').split('/').pop() ?? '';
  const cleaned = base.replaceAll(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  if (!cleaned || cleaned.startsWith('.') || cleaned.includes('..')) {
    return '';
  }
  return cleaned;
}

function extensionOf(filename: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/u.exec(filename);
  return match?.[1]?.toLowerCase() ?? '';
}

function safeType(value: string): string {
  return /^[A-Za-z0-9.+-]{1,80}\/[A-Za-z0-9.+-]{1,80}$/u.test(value)
    ? value
    : 'application/octet-stream';
}
