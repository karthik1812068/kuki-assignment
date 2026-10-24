import { readFile } from 'node:fs/promises';
import { extractDocument } from '@codepilot/indexing';
import { resolveWithinRoot } from '@codepilot/security';
import type { StoredDocument } from '@codepilot/database';

const RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DocumentExecutor {
  claim: (id: string, ownerId: string) => Promise<StoredDocument | null>;
  complete: (id: string, ownerId: string, extraction: unknown, kind: string) => Promise<void>;
  fail: (id: string, ownerId: string, message: string) => Promise<void>;
}

export async function executeDocumentJob(input: {
  documentId: string;
  ownerId: string;
  storageDir: string;
  store: DocumentExecutor;
}): Promise<'completed' | 'skipped' | 'failed'> {
  if (!RESOURCE_ID.test(input.documentId) || !RESOURCE_ID.test(input.ownerId)) {
    return 'skipped';
  }
  const claimed = await input.store.claim(input.documentId, input.ownerId);
  if (!claimed) {
    return 'skipped';
  }
  try {
    const file = resolveWithinRoot(input.storageDir, claimed.storageKey);
    const bytes = await readFile(file);
    const extraction = extractDocument(claimed.filename, bytes);
    await input.store.complete(claimed.id, input.ownerId, extraction, extraction.kind);
    return 'completed';
  } catch {
    await input.store.fail(
      claimed.id,
      input.ownerId,
      'This document could not be processed. Other uploads were not stopped.',
    );
    return 'failed';
  }
}
