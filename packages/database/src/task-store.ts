import type { Pool } from 'pg';

export interface TaskWrite {
  repositoryId: string;
  createdBy: string;
  title: string;
  description: string;
  mode: string;
  model: string | null;
}

export interface StoredTask {
  id: string;
  repositoryId: string;
  createdBy: string;
  title: string;
  description: string;
  mode: string;
  status: string;
  planSource: string | null;
  planSteps: string[];
  edits: unknown[];
  pendingGate: string | null;
  grantedGate: string | null;
  repairCount: number;
  previousFailureHash: string | null;
  outcome: string | null;
  error: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  callCount: number;
  estimatedCostUsd: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface TaskPhaseUpdate {
  status: string;
  planSource: string | null;
  planSteps: string[];
  edits: unknown[];
  pendingGate: string | null;
  grantedGate: string | null;
  repairCount: number;
  previousFailureHash: string | null;
  outcome: string | null;
  error: string | null;
  inputTokens: number;
  outputTokens: number;
  callCount: number;
  estimatedCostUsd: number | null;
  started: boolean;
  finished: boolean;
}

interface TaskRow {
  id: string;
  repository_id: string;
  created_by: string;
  title: string;
  description: string;
  mode: string;
  status: string;
  plan_source: string | null;
  plan_steps: string;
  edits: string;
  pending_gate: string | null;
  granted_gate: string | null;
  repair_count: number;
  previous_failure_hash: string | null;
  outcome: string | null;
  error: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  call_count: number;
  estimated_cost_usd: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

export class PgTaskStore {
  constructor(private readonly pool: Pool) {}

  async create(input: TaskWrite): Promise<StoredTask> {
    const inserted = await this.pool.query<TaskRow>(
      `INSERT INTO tasks (repository_id, created_by, title, description, mode, status, model)
       VALUES ($1, $2, $3, $4, $5, 'CREATED', $6)
       RETURNING ${COLUMNS}`,
      [
        input.repositoryId,
        input.createdBy,
        input.title,
        input.description,
        input.mode,
        input.model,
      ],
    );
    const row = inserted.rows[0];
    if (!row) {
      throw new Error('The task was not stored.');
    }
    await this.pool.query(
      `INSERT INTO agent_runs (task_id, model, status) VALUES ($1, $2, 'CREATED')`,
      [row.id, input.model],
    );
    return mapTask(row);
  }

  async claim(id: string, ownerId: string): Promise<StoredTask | null> {
    const result = await this.pool.query<TaskRow>(
      `UPDATE tasks
       SET claimed_at = now(), updated_at = now(),
           started_at = COALESCE(started_at, now())
       WHERE id = $1 AND created_by = $2
         AND (claimed_at IS NULL OR claimed_at < now() - interval '15 minutes')
         AND (
           (status = 'CREATED' AND pending_gate IS NULL)
           OR (status = 'WAITING_FOR_APPROVAL' AND granted_gate IS NOT NULL AND granted_gate = pending_gate)
         )
       RETURNING ${COLUMNS}`,
      [id, ownerId],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async findForOwner(id: string, ownerId: string): Promise<StoredTask | null> {
    const result = await this.pool.query<TaskRow>(
      `SELECT ${COLUMNS} FROM tasks WHERE id = $1 AND created_by = $2`,
      [id, ownerId],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async listForOwner(ownerId: string): Promise<StoredTask[]> {
    const result = await this.pool.query<TaskRow>(
      `SELECT ${COLUMNS} FROM tasks WHERE created_by = $1 ORDER BY created_at DESC LIMIT 100`,
      [ownerId],
    );
    return result.rows.map(mapTask);
  }

  async listForRepository(repositoryId: string, ownerId: string): Promise<StoredTask[]> {
    const result = await this.pool.query<TaskRow>(
      `SELECT ${COLUMNS} FROM tasks
       WHERE repository_id = $1 AND created_by = $2
       ORDER BY created_at DESC LIMIT 20`,
      [repositoryId, ownerId],
    );
    return result.rows.map(mapTask);
  }

  async decide(
    id: string,
    ownerId: string,
    decision: 'approve' | 'reject' | 'cancel',
  ): Promise<StoredTask | null> {
    if (decision === 'approve') {
      const result = await this.pool.query<TaskRow>(
        `UPDATE tasks
         SET granted_gate = pending_gate, updated_at = now()
         WHERE id = $1 AND created_by = $2
           AND status = 'WAITING_FOR_APPROVAL'
           AND pending_gate IS NOT NULL
           AND granted_gate IS DISTINCT FROM pending_gate
         RETURNING ${COLUMNS}`,
        [id, ownerId],
      );
      const row = result.rows[0];
      return row ? mapTask(row) : null;
    }
    const status = decision === 'cancel' ? 'CANCELLED' : 'FAILED';
    const outcome = decision === 'cancel' ? 'cancelled' : 'rejected';
    const result = await this.pool.query<TaskRow>(
      `UPDATE tasks
       SET status = $3, outcome = $4, pending_gate = NULL, claimed_at = NULL,
           completed_at = now(), updated_at = now(),
           error = CASE WHEN $3 = 'CANCELLED' THEN 'Cancelled.' ELSE 'Rejected.' END
       WHERE id = $1 AND created_by = $2 AND status = 'WAITING_FOR_APPROVAL'
       RETURNING ${COLUMNS}`,
      [id, ownerId, status, outcome],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async savePhase(id: string, ownerId: string, update: TaskPhaseUpdate): Promise<void> {
    await this.pool.query(
      `UPDATE tasks
       SET status = $3, plan_source = $4, plan_steps = $5, edits = $6,
           pending_gate = $7, granted_gate = $8, repair_count = $9,
           previous_failure_hash = $10, outcome = $11, error = $12,
           input_tokens = $13, output_tokens = $14, call_count = $15,
           estimated_cost_usd = $16,
           completed_at = CASE WHEN $17 THEN now() ELSE completed_at END,
           claimed_at = NULL, updated_at = now()
       WHERE id = $1 AND created_by = $2`,
      [
        id,
        ownerId,
        update.status,
        update.planSource,
        JSON.stringify(update.planSteps),
        JSON.stringify(update.edits),
        update.pendingGate,
        update.grantedGate,
        update.repairCount,
        update.previousFailureHash,
        update.outcome,
        update.error,
        update.inputTokens,
        update.outputTokens,
        update.callCount,
        update.estimatedCostUsd,
        update.finished,
      ],
    );
    await this.pool.query(
      `UPDATE agent_runs
       SET status = $2, input_tokens = $3, output_tokens = $4, call_count = $5,
           estimated_cost_usd = $6,
           completed_at = CASE WHEN $7 THEN now() ELSE completed_at END
       WHERE task_id = $1`,
      [
        id,
        update.status,
        update.inputTokens,
        update.outputTokens,
        update.callCount,
        update.estimatedCostUsd,
        update.finished,
      ],
    );
  }

  async addTransition(
    taskId: string,
    from: string | null,
    to: string,
    reason: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO agent_transitions (task_id, from_state, to_state, reason) VALUES ($1, $2, $3, $4)`,
      [taskId, from, to, reason],
    );
  }

  async addToolCall(
    taskId: string,
    name: string,
    status: string,
    durationMs: number,
    error: string | null,
    output: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO tool_calls (task_id, tool_name, output, status, duration_ms, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [taskId, name, output.slice(0, 4_000), status, durationMs, error],
    );
  }

  async addChange(
    taskId: string,
    change: {
      path: string;
      type: string;
      before: string;
      after: string;
      diff: string;
      reason: string;
    },
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO file_changes
         (task_id, file_path, change_type, old_content, new_content, diff, reason, applied)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [
        taskId,
        change.path,
        change.type,
        change.before.slice(0, 20_000),
        change.after.slice(0, 20_000),
        change.diff.slice(0, 20_000),
        change.reason.slice(0, 300),
      ],
    );
  }

  async addTest(
    taskId: string,
    test: {
      command: string;
      status: string;
      stdout: string;
      stderr: string;
      durationMs: number;
    },
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO test_runs (task_id, command, status, stdout, stderr, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        taskId,
        test.command.slice(0, 200),
        test.status,
        test.stdout.slice(0, 4_000),
        test.stderr.slice(0, 4_000),
        test.durationMs,
      ],
    );
  }

  async addFinding(
    taskId: string,
    finding: {
      severity: string;
      path: string;
      line: number | null;
      problem: string;
      explanation: string;
      recommendation: string;
      source: string;
    },
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO review_findings
         (task_id, severity, file_path, line_number, problem, explanation, recommendation, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        taskId,
        finding.severity,
        finding.path,
        finding.line,
        finding.problem,
        finding.explanation,
        finding.recommendation,
        finding.source,
      ],
    );
  }

  async addPullRequest(
    taskId: string,
    repositoryId: string,
    pull: {
      githubPrId: number | null;
      branch: string;
      title: string;
      body: string;
      url: string | null;
      status: string;
    },
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO pull_requests
         (task_id, repository_id, github_pr_id, branch_name, title, description, url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (task_id) DO UPDATE
         SET github_pr_id = EXCLUDED.github_pr_id, url = EXCLUDED.url, status = EXCLUDED.status`,
      [
        taskId,
        repositoryId,
        pull.githubPrId,
        pull.branch,
        pull.title,
        pull.body,
        pull.url,
        pull.status,
      ],
    );
  }

  async audit(entry: {
    userId: string | null;
    action: string;
    repositoryId: string | null;
    taskId: string | null;
    toolName: string | null;
    result: string;
    ip: string | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs (user_id, action, repository_id, task_id, tool_name, result, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.userId,
        entry.action,
        entry.repositoryId,
        entry.taskId,
        entry.toolName,
        entry.result.slice(0, 300),
        entry.ip,
      ],
    );
  }

  async details(
    id: string,
    ownerId: string,
  ): Promise<{
    task: StoredTask;
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
  } | null> {
    const task = await this.findForOwner(id, ownerId);
    if (!task) {
      return null;
    }
    const [changes, tools, tests, findings, pull] = await Promise.all([
      this.pool.query<{ file_path: string; change_type: string; diff: string; reason: string }>(
        `SELECT file_path, change_type, diff, reason FROM file_changes WHERE task_id = $1 ORDER BY created_at`,
        [id],
      ),
      this.pool.query<{
        tool_name: string;
        status: string;
        duration_ms: number | null;
        error: string | null;
      }>(
        `SELECT tool_name, status, duration_ms, error FROM tool_calls WHERE task_id = $1 ORDER BY created_at`,
        [id],
      ),
      this.pool.query<{
        command: string;
        status: string;
        stdout: string;
        stderr: string;
        duration_ms: number | null;
      }>(
        `SELECT command, status, stdout, stderr, duration_ms FROM test_runs WHERE task_id = $1 ORDER BY created_at`,
        [id],
      ),
      this.pool.query<{
        severity: string;
        file_path: string;
        line_number: number | null;
        problem: string;
        explanation: string;
        recommendation: string;
        source: string;
      }>(
        `SELECT severity, file_path, line_number, problem, explanation, recommendation, source
         FROM review_findings WHERE task_id = $1 ORDER BY created_at`,
        [id],
      ),
      this.pool.query<{ branch_name: string; title: string; url: string | null; status: string }>(
        `SELECT branch_name, title, url, status FROM pull_requests WHERE task_id = $1`,
        [id],
      ),
    ]);
    const pullRow = pull.rows[0];
    return {
      task,
      changes: changes.rows.map((row) => ({
        path: row.file_path,
        type: row.change_type,
        diff: row.diff,
        reason: row.reason,
      })),
      tools: tools.rows.map((row) => ({
        name: row.tool_name,
        status: row.status,
        durationMs: row.duration_ms,
        error: row.error,
      })),
      tests: tests.rows.map((row) => ({
        command: row.command,
        status: row.status,
        stdout: row.stdout,
        stderr: row.stderr,
        durationMs: row.duration_ms,
      })),
      findings: findings.rows.map((row) => ({
        severity: row.severity,
        path: row.file_path,
        line: row.line_number,
        problem: row.problem,
        explanation: row.explanation,
        recommendation: row.recommendation,
        source: row.source,
      })),
      pullRequest: pullRow
        ? {
            branch: pullRow.branch_name,
            title: pullRow.title,
            url: pullRow.url,
            status: pullRow.status,
          }
        : null,
    };
  }
}

const COLUMNS = `id, repository_id, created_by, title, description, mode, status, plan_source, plan_steps, edits,
  pending_gate, granted_gate, repair_count, previous_failure_hash, outcome, error, model,
  input_tokens, output_tokens, call_count, estimated_cost_usd, started_at, completed_at, created_at`;

function mapTask(row: TaskRow): StoredTask {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    mode: row.mode,
    status: row.status,
    planSource: row.plan_source,
    planSteps: readStringArray(row.plan_steps),
    edits: readArray(row.edits),
    pendingGate: row.pending_gate,
    grantedGate: row.granted_gate,
    repairCount: row.repair_count,
    previousFailureHash: row.previous_failure_hash,
    outcome: row.outcome,
    error: row.error,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    callCount: row.call_count,
    estimatedCostUsd: row.estimated_cost_usd === null ? null : Number(row.estimated_cost_usd),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function readStringArray(raw: string): string[] {
  const parsed = readArray(raw);
  return parsed.filter((item): item is string => typeof item === 'string');
}

function readArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
