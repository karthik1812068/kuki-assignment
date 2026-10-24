import { llmProviderFromEnv, LlmRequestError } from '@codepilot/ai';
import { documentStorageDir, loadFoundationEnv, repositoryStorageDir } from '@codepilot/config';
import {
  closeRedis,
  createBlockingRedisClient,
  createPostgresPool,
  createRedisClient,
  PgAuthRepository,
  PgDocumentStore,
  PgIndexStore,
  PgRepositoryStore,
  PgTaskStore,
  pingPostgres,
  pingRedis,
} from '@codepilot/database';
import { createLogger, errorMessage } from '@codepilot/logger';
import { decryptSecret } from '@codepilot/security';
import type { TaskExecutor } from './execute-task';
import { consumeWorkQueue } from './work-loop';

async function main(): Promise<void> {
  const env = loadFoundationEnv();
  const logger = createLogger('agent', { level: env.LOG_LEVEL });
  const pool = createPostgresPool(env.DATABASE_URL);
  const redis = createRedisClient(env.REDIS_URL);
  const queue = createBlockingRedisClient(env.REDIS_URL);
  const repositories = new PgRepositoryStore(pool);
  const indexes = new PgIndexStore(pool);
  const tasks = new PgTaskStore(pool);
  const documents = new PgDocumentStore(pool);
  const auth = new PgAuthRepository(pool);
  const provider = llmProviderFromEnv({
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
    baseUrl: env.LLM_BASE_URL,
  });
  let shuttingDown = false;

  const shutdown = async (signal: string, code: number): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'shutting down agent worker');
    queue.disconnect();
    await closeRedis(redis);
    await pool.end();
    process.exit(code);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT', 0);
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM', 0);
  });

  try {
    await pingPostgres(pool);
    await pingRedis(redis);
  } catch (error) {
    logger.error({ message: errorMessage(error) }, 'dependency check failed');
    await shutdown('startup', 1);
    return;
  }

  logger.info('worker ready');
  if (provider) {
    logger.info(
      { provider: provider.id, model: provider.model },
      'language model provider configured',
    );
  } else {
    logger.info('language model provider is not configured');
  }
  const taskStore: TaskExecutor = {
    claim: (taskId, ownerId) => tasks.claim(taskId, ownerId),
    savePhase: (id, ownerId, update) => tasks.savePhase(id, ownerId, update),
    addTransition: (taskId, from, to, reason) => tasks.addTransition(taskId, from, to, reason),
    addToolCall: (taskId, name, status, durationMs, error, output) =>
      tasks.addToolCall(taskId, name, status, durationMs, error, output),
    addChange: (taskId, change) => tasks.addChange(taskId, change),
    addTest: (taskId, test) => tasks.addTest(taskId, test),
    addFinding: (taskId, finding) => tasks.addFinding(taskId, finding),
    addPullRequest: (taskId, repositoryId, pull) =>
      tasks.addPullRequest(taskId, repositoryId, pull),
    audit: (entry) => tasks.audit(entry),
    repository: async (id, ownerId) => {
      const found = await repositories.findForOwner(id, ownerId);
      return found
        ? { fullName: found.fullName, defaultBranch: found.defaultBranch, status: found.status }
        : null;
    },
    token: async (ownerId) => {
      if (!env.ENCRYPTION_KEY) {
        return null;
      }
      const credential = await auth.findCredential(ownerId);
      if (!credential) {
        return null;
      }
      return decryptSecret(credential.ciphertext, env.ENCRYPTION_KEY);
    },
    modelConfigured: provider !== null,
    complete: async (systemPrompt, userPrompt) => {
      if (!provider) {
        return null;
      }
      try {
        const result = await provider.complete({
          model: provider.model,
          systemPrompt,
          userPrompt,
          maxOutputTokens: 1_200,
        });
        return {
          text: result.text,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        };
      } catch (error) {
        return {
          error:
            error instanceof LlmRequestError ? error.message : 'The language model request failed.',
        };
      }
    },
    repairLimit: env.AGENT_REPAIR_LIMIT,
    tokenBudget: env.AGENT_TOKEN_BUDGET,
    sandboxImage: env.SANDBOX_IMAGE,
    inputUsdPerMillion: env.LLM_INPUT_USD_PER_MILLION,
    outputUsdPerMillion: env.LLM_OUTPUT_USD_PER_MILLION,
  };
  await consumeWorkQueue({
    redis,
    queue,
    stopping: () => shuttingDown,
    logger,
    storageDir: repositoryStorageDir(env),
    documentDir: documentStorageDir(env),
    documentStore: {
      claim: (id, ownerId) => documents.claim(id, ownerId),
      complete: (id, ownerId, extraction, kind) =>
        documents.complete(id, ownerId, extraction, kind),
      fail: (id, ownerId, message) => documents.fail(id, ownerId, message),
    },
    indexStore: {
      findForOwner: (id, ownerId) => repositories.findForOwner(id, ownerId),
      markIndexingRunning: (id, ownerId) => repositories.markIndexingRunning(id, ownerId),
      markIndexingFailed: (id, ownerId, message) =>
        repositories.markIndexingFailed(id, ownerId, message),
      replaceIndex: (id, ownerId, build) => indexes.replaceIndex(id, ownerId, build),
    },
    taskStore,
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exit(1);
});
