import { INDEX_QUEUE_KEY, parseIndexJob } from '@codepilot/database';
import { errorMessage, type Logger } from '@codepilot/logger';
import { executeIndexJob, type IndexExecutor } from './execute-index';

export async function consumeIndexQueue(options: {
  queue: {
    brpop(key: string, timeout: number): Promise<[string, string] | null>;
  };
  stopping: () => boolean;
  logger: Logger;
  store: IndexExecutor;
  storageDir: string;
}): Promise<void> {
  while (!options.stopping()) {
    let raw: string | undefined;
    try {
      const popped = await options.queue.brpop(INDEX_QUEUE_KEY, 5);
      raw = popped?.[1];
    } catch (error) {
      if (options.stopping()) {
        return;
      }
      options.logger.error({ message: errorMessage(error) }, 'index queue read failed');
      await delay(1_000);
      continue;
    }
    if (!raw) {
      continue;
    }
    const job = parseIndexJob(raw);
    if (!job) {
      options.logger.error({ message: 'ignored an invalid index job' }, 'index job rejected');
      continue;
    }
    try {
      const result = await executeIndexJob({
        repositoryId: job.repositoryId,
        ownerId: job.ownerId,
        storageDir: options.storageDir,
        store: options.store,
      });
      options.logger.info({ repositoryId: job.repositoryId, result }, 'index job finished');
    } catch (error) {
      options.logger.error(
        { repositoryId: job.repositoryId, message: errorMessage(error) },
        'index job failed',
      );
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
