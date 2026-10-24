import type { Redis } from 'ioredis';

export const DOCUMENT_QUEUE_KEY = 'codepilot:document-queue';
export const DOCUMENT_PROCESSING_KEY = 'codepilot:document-processing';
export const DOCUMENT_DEAD_KEY = 'codepilot:document-dead';

const RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DocumentJob {
  documentId: string;
  ownerId: string;
}

export function parseDocumentJob(raw: string): DocumentJob | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.documentId !== 'string' || typeof record.ownerId !== 'string') {
    return null;
  }
  if (!RESOURCE_ID.test(record.documentId) || !RESOURCE_ID.test(record.ownerId)) {
    return null;
  }
  return { documentId: record.documentId, ownerId: record.ownerId };
}

export async function enqueueDocumentJob(client: Redis, job: DocumentJob): Promise<void> {
  const payload = parseDocumentJob(JSON.stringify(job));
  if (!payload) {
    throw new Error('Invalid document job.');
  }
  if (client.status === 'wait' || client.status === 'end') {
    await client.connect();
  }
  await client.lpush(DOCUMENT_QUEUE_KEY, JSON.stringify(payload));
}
