import { INDEX_QUEUE_KEY, parseIndexJob, parseTaskJob, TASK_QUEUE_KEY } from '@codepilot/database';
import { errorMessage, type Logger } from '@codepilot/logger';
import { executeIndexJob, type IndexExecutor } from './execute-index';
import { executeTaskJob, type TaskExecutor } from './execute-task';

export async function consumeWorkQueue(options: {
  queue: {
    brpop(...args: [...keys: string[], timeout: number]): Promise<[string, string] | null>;
  };
  stopping: () => boolean;
  logger: Logger;
  indexStore: IndexExecutor;
  taskStore: TaskExecutor;
  storageDir: string;
}): Promise<void> {
  while (!options.stopping()) {
    let popped: [string, string] | null;
    try {
      popped = await options.queue.brpop(INDEX_QUEUE_KEY, TASK_QUEUE_KEY, 5);
    } catch (error) {
      if (options.stopping()) {
        return;
      }
      options.logger.error({ message: errorMessage(error) }, 'work queue read failed');
      await delay(1_000);
      continue;
    }
    if (!popped) {
      continue;
    }
    const [key, raw] = popped;
    if (key === INDEX_QUEUE_KEY) {
      await runIndex(raw, options);
      continue;
    }
    if (key === TASK_QUEUE_KEY) {
      await runTask(raw, options);
    }
  }
}

async function runIndex(
  raw: string,
  options: {
    logger: Logger;
    indexStore: IndexExecutor;
    storageDir: string;
  },
): Promise<void> {
  const job = parseIndexJob(raw);
  if (!job) {
    options.logger.error({ message: 'ignored an invalid index job' }, 'index job rejected');
    return;
  }
  try {
    const result = await executeIndexJob({
      repositoryId: job.repositoryId,
      ownerId: job.ownerId,
      storageDir: options.storageDir,
      store: options.indexStore,
    });
    options.logger.info({ repositoryId: job.repositoryId, result }, 'index job finished');
  } catch (error) {
    options.logger.error(
      { repositoryId: job.repositoryId, message: errorMessage(error) },
      'index job failed',
    );
  }
}

async function runTask(
  raw: string,
  options: { logger: Logger; taskStore: TaskExecutor; storageDir: string },
): Promise<void> {
  const job = parseTaskJob(raw);
  if (!job) {
    options.logger.error({ message: 'ignored an invalid task job' }, 'task job rejected');
    return;
  }
  try {
    const result = await executeTaskJob({
      taskId: job.taskId,
      ownerId: job.ownerId,
      storageDir: options.storageDir,
      store: options.taskStore,
    });
    options.logger.info(
      { taskId: job.taskId, repositoryId: result.repositoryId, status: result.status },
      'task job finished',
    );
  } catch (error) {
    options.logger.error({ taskId: job.taskId, message: errorMessage(error) }, 'task job failed');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
