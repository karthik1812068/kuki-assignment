export interface MeasuredTask {
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
}

export interface TaskMeasurements {
  total: number;
  byStatus: Record<string, number>;
  completed: number;
  failed: number;
  cancelled: number;
  averageDurationMs: number | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  costMeasuredRuns: number;
}

export function summarizeTasks(tasks: readonly MeasuredTask[]): TaskMeasurements {
  const byStatus: Record<string, number> = {};
  let durationTotal = 0;
  let durationCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;
  let costMeasuredRuns = 0;
  let completed = 0;
  let failed = 0;
  let cancelled = 0;
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
    if (task.status === 'COMPLETED') {
      completed += 1;
    }
    if (task.status === 'FAILED') {
      failed += 1;
    }
    if (task.status === 'CANCELLED') {
      cancelled += 1;
    }
    if (task.startedAt && task.completedAt) {
      const start = Date.parse(task.startedAt);
      const end = Date.parse(task.completedAt);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        durationTotal += end - start;
        durationCount += 1;
      }
    }
    if (typeof task.inputTokens === 'number') {
      inputTokens += task.inputTokens;
    }
    if (typeof task.outputTokens === 'number') {
      outputTokens += task.outputTokens;
    }
    if (typeof task.estimatedCostUsd === 'number') {
      cost += task.estimatedCostUsd;
      costMeasuredRuns += 1;
    }
  }
  return {
    total: tasks.length,
    byStatus,
    completed,
    failed,
    cancelled,
    averageDurationMs: durationCount === 0 ? null : Math.round(durationTotal / durationCount),
    inputTokens,
    outputTokens,
    estimatedCostUsd: costMeasuredRuns === 0 ? null : Math.round(cost * 1_000_000) / 1_000_000,
    costMeasuredRuns,
  };
}
