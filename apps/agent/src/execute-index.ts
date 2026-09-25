import { buildRepositoryIndex, IndexError, type IndexBuild } from '@codepilot/indexing';
import { resolveWithinRoot } from '@codepilot/security';
import type { StoredRepository } from '@codepilot/database';

const RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INDEX_FAILURE_MESSAGE = 'Indexing failed.';
export const INDEX_MISSING_MESSAGE = 'The cloned files are not on this server.';

export interface IndexExecutor {
  findForOwner(id: string, ownerId: string): Promise<StoredRepository | null>;
  markIndexingRunning(id: string, ownerId: string): Promise<StoredRepository | null>;
  markIndexingFailed(
    id: string,
    ownerId: string,
    message: string,
  ): Promise<StoredRepository | null>;
  replaceIndex(id: string, ownerId: string, build: IndexBuild): Promise<boolean>;
}

export async function executeIndexJob(options: {
  repositoryId: string;
  ownerId: string;
  storageDir: string;
  store: IndexExecutor;
}): Promise<'completed' | 'skipped' | 'failed'> {
  if (!RESOURCE_ID.test(options.repositoryId) || !RESOURCE_ID.test(options.ownerId)) {
    return 'skipped';
  }
  const row = await options.store.findForOwner(options.repositoryId, options.ownerId);
  if (!row || row.status !== 'cloned') {
    return 'skipped';
  }
  const running = await options.store.markIndexingRunning(options.repositoryId, options.ownerId);
  if (!running) {
    return 'skipped';
  }

  try {
    const root = resolveWithinRoot(
      options.storageDir,
      `${options.ownerId}/${options.repositoryId}`,
    );
    const build = await buildRepositoryIndex(root);
    const saved = await options.store.replaceIndex(options.repositoryId, options.ownerId, build);
    if (!saved) {
      await options.store.markIndexingFailed(
        options.repositoryId,
        options.ownerId,
        INDEX_FAILURE_MESSAGE,
      );
      return 'failed';
    }
    return 'completed';
  } catch (error) {
    const message = error instanceof IndexError ? INDEX_MISSING_MESSAGE : INDEX_FAILURE_MESSAGE;
    await options.store.markIndexingFailed(options.repositoryId, options.ownerId, message);
    return 'failed';
  }
}
