import {
  DOCUMENT_DEAD_KEY,
  DOCUMENT_PROCESSING_KEY,
  DOCUMENT_QUEUE_KEY,
  INDEX_DEAD_KEY,
  INDEX_PROCESSING_KEY,
  INDEX_QUEUE_KEY,
  TASK_DEAD_KEY,
  TASK_PROCESSING_KEY,
  TASK_QUEUE_KEY,
  ackWork,
  failWork,
  parseDocumentJob,
  parseIndexJob,
  parseTaskJob,
  reclaimProcessing,
  takeWork,
  touchWorkerHeartbeat,
  type WorkRedis,
} from '@codepilot/database';
import { errorMessage, type Logger } from '@codepilot/logger';
import { executeDocumentJob, type DocumentExecutor } from './execute-document';
import { executeIndexJob, type IndexExecutor } from './execute-index';
import { executeTaskJob, type TaskExecutor } from './execute-task';

export async function consumeWorkQueue(options: {
  redis: WorkRedis;
  queue: WorkRedis;
  stopping: () => boolean;
  logger: Logger;
  indexStore: IndexExecutor;
  taskStore: TaskExecutor;
  documentStore: DocumentExecutor;
  storageDir: string;
  documentDir: string;
}): Promise<void> {
  const indexMoved = await reclaimProcessing(options.redis, INDEX_PROCESSING_KEY, INDEX_QUEUE_KEY);
  const taskMoved = await reclaimProcessing(options.redis, TASK_PROCESSING_KEY, TASK_QUEUE_KEY);
  const documentMoved = await reclaimProcessing(
    options.redis,
    DOCUMENT_PROCESSING_KEY,
    DOCUMENT_QUEUE_KEY,
  );
  if (indexMoved > 0 || taskMoved > 0 || documentMoved > 0) {
    options.logger.info({ indexMoved, taskMoved, documentMoved }, 'requeued unfinished work');
  }
  while (!options.stopping()) {
    try {
      await touchWorkerHeartbeat(options.redis);
    } catch (error) {
      options.logger.error({ message: errorMessage(error) }, 'worker heartbeat failed');
    }
    let raw: string | null;
    let kind: 'index' | 'task' | 'document' | null;
    try {
      raw = await takeWork(options.queue, INDEX_QUEUE_KEY, INDEX_PROCESSING_KEY, 1);
      kind = raw ? 'index' : null;
      if (!raw) {
        raw = await takeWork(options.queue, DOCUMENT_QUEUE_KEY, DOCUMENT_PROCESSING_KEY, 2);
        kind = raw ? 'document' : null;
      }
      if (!raw) {
        raw = await takeWork(options.queue, TASK_QUEUE_KEY, TASK_PROCESSING_KEY, 2);
        kind = raw ? 'task' : null;
      }
    } catch (error) {
      if (options.stopping()) {
        return;
      }
      options.logger.error({ message: errorMessage(error) }, 'work queue read failed');
      await delay(1_000);
      continue;
    }
    if (!raw || !kind) {
      continue;
    }
    if (kind === 'index') {
      await runIndex(raw, options);
      continue;
    }
    if (kind === 'document') {
      await runDocument(raw, options);
      continue;
    }
    await runTask(raw, options);
  }
}

async function runIndex(
  raw: string,
  options: {
    redis: WorkRedis;
    logger: Logger;
    indexStore: IndexExecutor;
    storageDir: string;
  },
): Promise<void> {
  const job = parseIndexJob(raw);
  if (!job) {
    await ackWork(options.redis, INDEX_PROCESSING_KEY, raw);
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
    await ackWork(options.redis, INDEX_PROCESSING_KEY, raw);
    options.logger.info({ repositoryId: job.repositoryId, result }, 'index job finished');
  } catch (error) {
    const outcome = await failWork(
      options.redis,
      INDEX_PROCESSING_KEY,
      INDEX_QUEUE_KEY,
      INDEX_DEAD_KEY,
      raw,
    );
    options.logger.error(
      { repositoryId: job.repositoryId, outcome, message: errorMessage(error) },
      'index job failed',
    );
  }
}

async function runDocument(
  raw: string,
  options: {
    redis: WorkRedis;
    logger: Logger;
    documentStore: DocumentExecutor;
    documentDir: string;
  },
): Promise<void> {
  const job = parseDocumentJob(raw);
  if (!job) {
    await ackWork(options.redis, DOCUMENT_PROCESSING_KEY, raw);
    options.logger.error({ message: 'ignored an invalid document job' }, 'document job rejected');
    return;
  }
  try {
    const result = await executeDocumentJob({
      documentId: job.documentId,
      ownerId: job.ownerId,
      storageDir: options.documentDir,
      store: options.documentStore,
    });
    await ackWork(options.redis, DOCUMENT_PROCESSING_KEY, raw);
    options.logger.info({ documentId: job.documentId, result }, 'document job finished');
  } catch (error) {
    const outcome = await failWork(
      options.redis,
      DOCUMENT_PROCESSING_KEY,
      DOCUMENT_QUEUE_KEY,
      DOCUMENT_DEAD_KEY,
      raw,
    );
    options.logger.error(
      { documentId: job.documentId, outcome, message: errorMessage(error) },
      'document job failed',
    );
  }
}

async function runTask(
  raw: string,
  options: { redis: WorkRedis; logger: Logger; taskStore: TaskExecutor; storageDir: string },
): Promise<void> {
  const job = parseTaskJob(raw);
  if (!job) {
    await ackWork(options.redis, TASK_PROCESSING_KEY, raw);
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
    await ackWork(options.redis, TASK_PROCESSING_KEY, raw);
    options.logger.info(
      { taskId: job.taskId, repositoryId: result.repositoryId, status: result.status },
      'task job finished',
    );
  } catch (error) {
    const outcome = await failWork(
      options.redis,
      TASK_PROCESSING_KEY,
      TASK_QUEUE_KEY,
      TASK_DEAD_KEY,
      raw,
    );
    options.logger.error(
      { taskId: job.taskId, outcome, message: errorMessage(error) },
      'task job failed',
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
