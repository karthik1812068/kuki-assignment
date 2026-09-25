const MODES = new Set(['implement', 'review', 'security', 'docs', 'issue']);
const STATUSES = new Set([
  'CREATED',
  'ANALYZING',
  'PLANNING',
  'WAITING_FOR_APPROVAL',
  'EXECUTING',
  'TESTING',
  'ANALYZING_FAILURE',
  'FIXING',
  'VALIDATING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export interface TaskSummary {
  id: string;
  repositoryId: string;
  title: string;
  mode: string;
  status: string;
  outcome: string | null;
  error: string | null;
  pendingGate: 'plan' | 'git' | null;
  createdAt: string;
}

export interface TaskDetail extends TaskSummary {
  description: string;
  plan: { source: string | null; steps: string[] } | null;
  repairCount: number;
  model: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    callCount: number;
    estimatedCostUsd: number | null;
  };
  changes: Array<{ path: string; type: string; diff: string; reason: string }>;
  tools: Array<{ name: string; status: string; durationMs: number | null; error: string | null }>;
  tests: Array<{
    command: string;
    status: string;
    stdout: string;
    stderr: string;
    durationMs: number | null;
  }>;
  findings: Array<{
    severity: string;
    path: string;
    line: number | null;
    problem: string;
    explanation: string;
    recommendation: string;
    source: string;
  }>;
  pullRequest: { branch: string; title: string; url: string | null; status: string } | null;
}

export interface TaskMeasurements {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageDurationMs: number | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  costMeasuredRuns: number;
}

export function parseTaskSummary(value: unknown): TaskSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isId(record.id) || !isId(record.repositoryId) || typeof record.title !== 'string') {
    return null;
  }
  if (typeof record.mode !== 'string' || !MODES.has(record.mode)) {
    return null;
  }
  if (typeof record.status !== 'string' || !STATUSES.has(record.status)) {
    return null;
  }
  const pending = record.pendingGate;
  if (pending !== null && pending !== 'plan' && pending !== 'git') {
    return null;
  }
  if (typeof record.createdAt !== 'string') {
    return null;
  }
  return {
    id: record.id,
    repositoryId: record.repositoryId,
    title: record.title.slice(0, 120),
    mode: record.mode,
    status: record.status,
    outcome: typeof record.outcome === 'string' ? record.outcome.slice(0, 40) : null,
    error: typeof record.error === 'string' ? record.error.slice(0, 300) : null,
    pendingGate: pending,
    createdAt: record.createdAt,
  };
}

export function parseTaskDetail(value: unknown): TaskDetail | null {
  const summary = parseTaskSummary(value);
  if (!summary || !value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.description !== 'string' || typeof record.repairCount !== 'number') {
    return null;
  }
  const usage = record.usage;
  if (!usage || typeof usage !== 'object') {
    return null;
  }
  const usageRecord = usage as Record<string, unknown>;
  if (
    typeof usageRecord.inputTokens !== 'number' ||
    typeof usageRecord.outputTokens !== 'number' ||
    typeof usageRecord.callCount !== 'number'
  ) {
    return null;
  }
  return {
    ...summary,
    description: record.description.slice(0, 4_000),
    plan: readPlan(record.plan),
    repairCount: record.repairCount,
    model: typeof record.model === 'string' ? record.model.slice(0, 80) : null,
    usage: {
      inputTokens: usageRecord.inputTokens,
      outputTokens: usageRecord.outputTokens,
      callCount: usageRecord.callCount,
      estimatedCostUsd:
        typeof usageRecord.estimatedCostUsd === 'number' ? usageRecord.estimatedCostUsd : null,
    },
    changes: readChanges(record.changes),
    tools: readTools(record.tools),
    tests: readTests(record.tests),
    findings: readFindings(record.findings),
    pullRequest: readPull(record.pullRequest),
  };
}

export function parseTaskList(value: unknown): TaskSummary[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const tasks: TaskSummary[] = [];
  for (const entry of value) {
    const task = parseTaskSummary(entry);
    if (!task) {
      return null;
    }
    tasks.push(task);
  }
  return tasks;
}

export function parseMeasurements(value: unknown): TaskMeasurements | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.total !== 'number' ||
    typeof record.completed !== 'number' ||
    typeof record.failed !== 'number' ||
    typeof record.cancelled !== 'number' ||
    typeof record.inputTokens !== 'number' ||
    typeof record.outputTokens !== 'number' ||
    typeof record.costMeasuredRuns !== 'number'
  ) {
    return null;
  }
  return {
    total: record.total,
    completed: record.completed,
    failed: record.failed,
    cancelled: record.cancelled,
    averageDurationMs:
      typeof record.averageDurationMs === 'number' ? record.averageDurationMs : null,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    estimatedCostUsd: typeof record.estimatedCostUsd === 'number' ? record.estimatedCostUsd : null,
    costMeasuredRuns: record.costMeasuredRuns,
  };
}

function readPlan(value: unknown): TaskDetail['plan'] {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.steps)) {
    return null;
  }
  const steps = record.steps
    .filter((step): step is string => typeof step === 'string')
    .slice(0, 12);
  return { source: typeof record.source === 'string' ? record.source : null, steps };
}

function readChanges(value: unknown): TaskDetail['changes'] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const record = entry as Record<string, unknown>;
    if (
      typeof record.path !== 'string' ||
      typeof record.diff !== 'string' ||
      typeof record.reason !== 'string'
    ) {
      return [];
    }
    return [
      {
        path: record.path.slice(0, 300),
        type: typeof record.type === 'string' ? record.type : 'edit',
        diff: record.diff.slice(0, 8_000),
        reason: record.reason.slice(0, 300),
      },
    ];
  });
}

function readTools(value: unknown): TaskDetail['tools'] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== 'string' || typeof record.status !== 'string') {
      return [];
    }
    return [
      {
        name: record.name.slice(0, 80),
        status: record.status,
        durationMs: typeof record.durationMs === 'number' ? record.durationMs : null,
        error: typeof record.error === 'string' ? record.error.slice(0, 300) : null,
      },
    ];
  });
}

function readTests(value: unknown): TaskDetail['tests'] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.command !== 'string' || typeof record.status !== 'string') {
      return [];
    }
    return [
      {
        command: record.command.slice(0, 200),
        status: record.status,
        stdout: typeof record.stdout === 'string' ? record.stdout.slice(0, 4_000) : '',
        stderr: typeof record.stderr === 'string' ? record.stderr.slice(0, 4_000) : '',
        durationMs: typeof record.durationMs === 'number' ? record.durationMs : null,
      },
    ];
  });
}

function readFindings(value: unknown): TaskDetail['findings'] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.problem !== 'string' || typeof record.path !== 'string') {
      return [];
    }
    return [
      {
        severity: typeof record.severity === 'string' ? record.severity : 'low',
        path: record.path.slice(0, 300),
        line: typeof record.line === 'number' ? record.line : null,
        problem: record.problem.slice(0, 300),
        explanation: typeof record.explanation === 'string' ? record.explanation.slice(0, 300) : '',
        recommendation:
          typeof record.recommendation === 'string' ? record.recommendation.slice(0, 300) : '',
        source: typeof record.source === 'string' ? record.source : 'static',
      },
    ];
  });
}

function readPull(value: unknown): TaskDetail['pullRequest'] {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.branch !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.status !== 'string'
  ) {
    return null;
  }
  const url =
    typeof record.url === 'string' && record.url.startsWith('https://github.com/')
      ? record.url
      : null;
  return {
    branch: record.branch.slice(0, 120),
    title: record.title.slice(0, 200),
    url,
    status: record.status,
  };
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}
