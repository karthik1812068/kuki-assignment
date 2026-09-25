import type { Redis } from 'ioredis';
import type { PgRepositoryStore, PgTaskStore, StoredTask } from '@codepilot/database';
import { enqueueTaskJob } from '@codepilot/database';
import { summarizeTasks } from '@codepilot/tools';

const MODES = new Set(['implement', 'review', 'security', 'docs', 'issue']);

export class TaskFlowError extends Error {
  override readonly name = 'TaskFlowError';

  constructor(
    readonly reason: 'not_found' | 'not_cloned' | 'queue_unavailable' | 'rate_limited' | 'invalid',
  ) {
    super(reason);
  }
}

export class TaskService {
  constructor(
    private readonly tasks: PgTaskStore,
    private readonly repositories: PgRepositoryStore,
    private readonly redis: Redis,
    private readonly rateLimit: number,
    private readonly model: string | null,
  ) {}

  async create(
    ownerId: string,
    input: { repositoryId: string; title: string; description: string; mode?: string },
    ip: string | null,
  ): Promise<StoredTask> {
    const title = clean(input.title, 120);
    const description = clean(input.description, 4_000);
    const mode = input.mode ?? 'implement';
    if (!title || !description || !MODES.has(mode)) {
      throw new TaskFlowError('invalid');
    }
    const repository = await this.repositories.findForOwner(input.repositoryId, ownerId);
    if (!repository) {
      throw new TaskFlowError('not_found');
    }
    if (repository.status !== 'cloned') {
      throw new TaskFlowError('not_cloned');
    }
    const allowed = await this.takeSlot(ownerId);
    if (!allowed) {
      throw new TaskFlowError('rate_limited');
    }
    const task = await this.tasks.create({
      repositoryId: repository.id,
      createdBy: ownerId,
      title,
      description,
      mode,
      model: this.model,
    });
    try {
      await enqueueTaskJob(this.redis, { taskId: task.id, ownerId });
    } catch {
      throw new TaskFlowError('queue_unavailable');
    }
    await this.tasks.audit({
      userId: ownerId,
      action: 'task.create',
      repositoryId: repository.id,
      taskId: task.id,
      toolName: null,
      result: 'queued',
      ip,
    });
    return task;
  }

  async decide(
    ownerId: string,
    taskId: string,
    decision: 'approve' | 'reject' | 'cancel',
    ip: string | null,
  ): Promise<StoredTask> {
    const updated = await this.tasks.decide(taskId, ownerId, decision);
    if (!updated) {
      throw new TaskFlowError('not_found');
    }
    if (decision === 'approve') {
      try {
        await enqueueTaskJob(this.redis, { taskId: updated.id, ownerId });
      } catch {
        throw new TaskFlowError('queue_unavailable');
      }
    }
    await this.tasks.audit({
      userId: ownerId,
      action: `task.${decision}`,
      repositoryId: updated.repositoryId,
      taskId: updated.id,
      toolName: null,
      result: updated.status,
      ip,
    });
    return updated;
  }

  list(ownerId: string): Promise<StoredTask[]> {
    return this.tasks.listForOwner(ownerId);
  }

  async details(ownerId: string, taskId: string) {
    const details = await this.tasks.details(taskId, ownerId);
    if (!details) {
      throw new TaskFlowError('not_found');
    }
    return publicTask(details);
  }

  async summary(ownerId: string) {
    const tasks = await this.tasks.listForOwner(ownerId);
    return summarizeTasks(
      tasks.map((task) => ({
        status: task.status,
        startedAt: task.startedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        inputTokens: task.inputTokens,
        outputTokens: task.outputTokens,
        estimatedCostUsd: task.estimatedCostUsd,
      })),
    );
  }

  async repositoryTasks(ownerId: string, repositoryId: string): Promise<StoredTask[]> {
    const repository = await this.repositories.findForOwner(repositoryId, ownerId);
    if (!repository) {
      throw new TaskFlowError('not_found');
    }
    return this.tasks.listForRepository(repositoryId, ownerId);
  }

  private async takeSlot(ownerId: string): Promise<boolean> {
    const key = `codepilot:task-rate:${ownerId}`;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, 3_600);
      }
      return count <= this.rateLimit;
    } catch {
      throw new TaskFlowError('queue_unavailable');
    }
  }
}

export function publicTask(details: Awaited<ReturnType<PgTaskStore['details']>> & object) {
  const task = details.task;
  return {
    id: task.id,
    repositoryId: task.repositoryId,
    title: task.title,
    description: task.description,
    mode: task.mode,
    status: task.status,
    outcome: task.outcome,
    error: task.error,
    pendingGate: task.pendingGate,
    plan: task.planSteps.length > 0 ? { source: task.planSource, steps: task.planSteps } : null,
    repairCount: task.repairCount,
    model: task.model,
    usage: {
      inputTokens: task.inputTokens,
      outputTokens: task.outputTokens,
      callCount: task.callCount,
      estimatedCostUsd: task.estimatedCostUsd,
    },
    changes: details.changes,
    tools: details.tools,
    tests: details.tests,
    findings: details.findings,
    pullRequest: details.pullRequest,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
  };
}

function clean(value: string, max: number): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 31 || char === '\n' || char === '\t') {
      result += char;
    }
    if (result.length >= max) {
      break;
    }
  }
  return result.trim();
}
