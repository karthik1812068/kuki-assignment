import { createHash } from 'node:crypto';
import {
  AgentStateMachine,
  buildAgentPrompt,
  estimateModelCost,
  repairDecision,
} from '@codepilot/ai';
import type { AgentState } from '@codepilot/types';
import type { AppliedEdit, ProposedEdit, ReviewFinding } from '@codepilot/tools';

export type TaskMode = 'implement' | 'review' | 'security' | 'docs' | 'issue';
export type TaskGate = 'plan' | 'git';

export interface TaskSnapshot {
  title: string;
  description: string;
  mode: TaskMode;
  status: AgentState;
  plan: { source: 'model' | 'repository-search'; steps: string[] } | null;
  edits: ProposedEdit[];
  pendingGate: TaskGate | null;
  grantedGate: TaskGate | null;
  repairCount: number;
  previousFailureHash: string | null;
  outcome: string | null;
  error: string | null;
  modelConfigured: boolean;
  inputTokens: number;
  outputTokens: number;
  callCount: number;
  estimatedCostUsd: number | null;
  changes: AppliedEdit[];
  tests: Array<{
    command: string;
    status: string;
    stdout: string;
    stderr: string;
    durationMs: number;
  }>;
  findings: ReviewFinding[];
  pullRequest: {
    branch: string;
    url: string | null;
    githubPrId: number | null;
    title: string;
    body: string;
    status: string;
  } | null;
  transitions: Array<{ from: string | null; to: string; reason: string }>;
  toolCalls: Array<{
    name: string;
    status: string;
    durationMs: number;
    error: string | null;
    output: string;
  }>;
}

export interface TaskPorts {
  inspect: (task: string) => Promise<{ excerpts: string; steps: string[] }>;
  propose: (
    systemPrompt: string,
    userPrompt: string,
  ) => Promise<{ text: string; inputTokens: number; outputTokens: number } | { error: string }>;
  apply: (
    edits: readonly ProposedEdit[],
  ) => Promise<{ ok: true; changes: AppliedEdit[] } | { ok: false; message: string }>;
  test: () => Promise<{
    status: 'passed' | 'failed' | 'not_run' | 'blocked';
    command: string;
    stdout: string;
    stderr: string;
    durationMs: number;
  }>;
  review: (paths: readonly string[]) => Promise<ReviewFinding[]>;
  publish: () => Promise<
    | {
        ok: true;
        url: string;
        githubPrId: number | null;
        branch: string;
        title: string;
        body: string;
      }
    | { ok: false; message: string }
  >;
  parseProposal: (raw: string) => { steps: string[]; edits: ProposedEdit[] } | null;
}

const TERMINAL = new Set<AgentState>(['COMPLETED', 'FAILED', 'CANCELLED']);

export async function runTaskPhase(
  current: TaskSnapshot,
  options: {
    repairLimit: number;
    tokenBudget: number;
    inputUsdPerMillion?: number;
    outputUsdPerMillion?: number;
    ports: TaskPorts;
  },
): Promise<TaskSnapshot> {
  const task = clone(current);
  if (TERMINAL.has(task.status)) {
    return task;
  }
  const machine = new AgentStateMachine(() => new Date(), task.status);
  const record = (reason: string, to?: AgentState): void => {
    if (to) {
      const entry = machine.transition(to, reason);
      task.transitions.push({ from: entry.from, to: entry.to, reason: entry.reason });
      task.status = entry.to;
    }
  };

  if (task.status === 'CREATED') {
    record('inspect repository', 'ANALYZING');
    const inspected = await options.ports.inspect(`${task.title}\n${task.description}`);
    task.toolCalls.push({
      name: 'search_code',
      status: 'completed',
      durationMs: 0,
      error: null,
      output: inspected.excerpts.slice(0, 4_000),
    });
    const proposal = await draft(task, inspected, options);
    if (!proposal) {
      return fail(task, machine, task.error ?? 'The plan could not be created.');
    }
    task.plan = { source: proposal.source, steps: proposal.steps };
    task.edits = filterEdits(task.mode, proposal.edits);
    record('draft plan', 'PLANNING');
    record('plan ready', 'WAITING_FOR_APPROVAL');
    task.pendingGate = 'plan';
    return task;
  }

  if (task.status !== 'WAITING_FOR_APPROVAL' || task.grantedGate !== task.pendingGate) {
    return task;
  }

  if (task.pendingGate === 'plan') {
    record('apply approved plan', 'EXECUTING');
    if (task.edits.length > 0) {
      const applied = await options.ports.apply(task.edits);
      task.toolCalls.push({
        name: 'edit_file',
        status: applied.ok ? 'completed' : 'failed',
        durationMs: 0,
        error: applied.ok ? null : applied.message,
        output: applied.ok ? `${applied.changes.length} files` : '',
      });
      if (!applied.ok) {
        return fail(task, machine, applied.message);
      }
      task.changes = applied.changes;
    }
    const tested = await runTests(task, machine, options);
    if (!tested) {
      return task;
    }
    record('review changes', 'VALIDATING');
    task.findings = await options.ports.review(task.changes.map((change) => change.path));
    if (task.changes.length === 0) {
      record('inspection finished', 'COMPLETED');
      task.outcome = task.mode === 'implement' ? 'inspection_only' : task.mode;
      task.pendingGate = null;
      return task;
    }
    record('approve commit and pull request', 'WAITING_FOR_APPROVAL');
    task.pendingGate = 'git';
    task.outcome = 'changed';
    return task;
  }

  record('publish approved changes', 'EXECUTING');
  const published = await options.ports.publish();
  task.toolCalls.push({
    name: 'create_pull_request',
    status: published.ok ? 'completed' : 'failed',
    durationMs: 0,
    error: published.ok ? null : published.message,
    output: published.ok ? published.url : '',
  });
  if (!published.ok) {
    return fail(task, machine, published.message);
  }
  task.pullRequest = {
    branch: published.branch,
    url: published.url,
    githubPrId: published.githubPrId,
    title: published.title,
    body: published.body,
    status: 'open',
  };
  const rechecked = await runTests(task, machine, options);
  if (!rechecked) {
    return task;
  }
  record('confirm pull request', 'VALIDATING');
  record('pull request opened', 'COMPLETED');
  task.outcome = 'pull_request';
  task.pendingGate = null;
  return task;
}

async function draft(
  task: TaskSnapshot,
  inspected: { excerpts: string; steps: string[] },
  options: {
    tokenBudget: number;
    inputUsdPerMillion?: number;
    outputUsdPerMillion?: number;
    ports: TaskPorts;
  },
): Promise<{
  source: 'model' | 'repository-search';
  steps: string[];
  edits: ProposedEdit[];
} | null> {
  if (!task.modelConfigured) {
    return {
      source: 'repository-search',
      steps: inspected.steps.length > 0 ? inspected.steps : ['No readable match was found.'],
      edits: [],
    };
  }
  if (task.inputTokens + task.outputTokens >= options.tokenBudget) {
    task.error = 'The token budget was reached.';
    return null;
  }
  const prompt = buildAgentPrompt('planner', {
    task: [
      'Reply with JSON only. Use keys steps and edits.',
      'edits items use path, type, content or oldText and newText, and reason.',
      'type must be create, write, edit, or delete. Use edit with oldText and newText to change existing text.',
      'If the task names a financial year (FY2024, FY 2023-24), keep that period. Do not replace it with a calendar year.',
      `Mode: ${task.mode}.`,
      `Title: ${task.title}`,
      task.description,
    ].join('\n'),
    untrustedContext: inspected.excerpts,
  });
  const proposed = await options.ports.propose(prompt.systemPrompt, prompt.userPrompt);
  if ('error' in proposed) {
    task.error = proposed.error;
    return null;
  }
  task.inputTokens += proposed.inputTokens;
  task.outputTokens += proposed.outputTokens;
  task.callCount += 1;
  const cost = estimateModelCost(
    task.inputTokens,
    task.outputTokens,
    options.inputUsdPerMillion,
    options.outputUsdPerMillion,
  );
  task.estimatedCostUsd = cost;
  const parsed = options.ports.parseProposal(proposed.text);
  if (!parsed) {
    task.error = 'The language model response was not usable.';
    return null;
  }
  return { source: 'model', steps: parsed.steps, edits: parsed.edits };
}

async function runTests(
  task: TaskSnapshot,
  machine: AgentStateMachine,
  options: {
    repairLimit: number;
    ports: TaskPorts;
    tokenBudget: number;
    inputUsdPerMillion?: number;
    outputUsdPerMillion?: number;
  },
): Promise<boolean> {
  while (task.status === 'EXECUTING' || task.status === 'FIXING' || task.status === 'TESTING') {
    if (task.status !== 'TESTING') {
      const entry = machine.transition('TESTING', 'run sandbox');
      task.transitions.push({ from: entry.from, to: entry.to, reason: entry.reason });
      task.status = 'TESTING';
    }
    const result = await options.ports.test();
    task.tests.push(result);
    task.toolCalls.push({
      name: 'run_tests',
      status: result.status,
      durationMs: result.durationMs,
      error:
        result.status === 'failed' || result.status === 'blocked'
          ? result.stderr.slice(0, 300)
          : null,
      output: `${result.stdout}\n${result.stderr}`.slice(0, 4_000),
    });
    if (result.status === 'blocked') {
      fail(task, machine, result.stderr.slice(0, 200) || 'The sandbox is not available.');
      return false;
    }
    const hash = createHash('sha256').update(result.stderr).digest('hex').slice(0, 16);
    const decision = repairDecision({
      failed: result.status === 'failed',
      repairCount: task.repairCount,
      repairLimit: options.repairLimit,
      failureHash: hash,
      previousHash: task.previousFailureHash,
      modelConfigured: task.modelConfigured,
      securityViolation: false,
      cancelled: false,
    });
    if (decision === 'pass') {
      return true;
    }
    if (decision === 'stop') {
      const message = !task.modelConfigured
        ? 'The sandbox failed and no language model is configured to propose a fix.'
        : task.previousFailureHash === hash
          ? 'The same sandbox failure repeated.'
          : 'The repair limit was reached.';
      fail(task, machine, result.status === 'not_run' ? 'The sandbox did not run.' : message);
      return false;
    }
    const failure = machine.transition('ANALYZING_FAILURE', 'read sandbox output');
    task.transitions.push({ from: failure.from, to: failure.to, reason: failure.reason });
    task.status = 'ANALYZING_FAILURE';
    const fixing = machine.transition('FIXING', 'propose a fix');
    task.transitions.push({ from: fixing.from, to: fixing.to, reason: fixing.reason });
    task.status = 'FIXING';
    const repair = await draft(
      task,
      { excerpts: result.stderr.slice(0, 4_000), steps: ['Fix the sandbox failure.'] },
      options,
    );
    if (!repair || repair.edits.length === 0) {
      fail(task, machine, task.error ?? 'The repair did not include an edit.');
      return false;
    }
    const applied = await options.ports.apply(filterEdits(task.mode, repair.edits));
    if (!applied.ok) {
      fail(task, machine, applied.message);
      return false;
    }
    task.changes = [...task.changes, ...applied.changes];
    task.repairCount += 1;
    task.previousFailureHash = hash;
  }
  return false;
}

function filterEdits(mode: TaskMode, edits: ProposedEdit[]): ProposedEdit[] {
  if (mode === 'review' || mode === 'security') {
    return [];
  }
  if (mode === 'docs') {
    return edits.filter((edit) => edit.path.endsWith('.md'));
  }
  return edits;
}

function fail(task: TaskSnapshot, machine: AgentStateMachine, message: string): TaskSnapshot {
  if (task.status !== 'FAILED' && task.status !== 'CANCELLED' && task.status !== 'COMPLETED') {
    const entry = machine.transition('FAILED', message);
    task.transitions.push({ from: entry.from, to: entry.to, reason: entry.reason });
    task.status = 'FAILED';
  }
  task.error = message;
  task.outcome = 'failed';
  task.pendingGate = null;
  return task;
}

function clone(task: TaskSnapshot): TaskSnapshot {
  return {
    ...task,
    plan: task.plan ? { ...task.plan, steps: [...task.plan.steps] } : null,
    edits: [...task.edits],
    changes: [...task.changes],
    tests: [...task.tests],
    findings: [...task.findings],
    transitions: [...task.transitions],
    toolCalls: [...task.toolCalls],
    pullRequest: task.pullRequest ? { ...task.pullRequest } : null,
  };
}
