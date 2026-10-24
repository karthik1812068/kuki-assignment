import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { StoredTask, TaskPhaseUpdate } from '@codepilot/database';
import type { AgentState } from '@codepilot/types';
import {
  applyEdit,
  EditError,
  dockerRunArgs,
  gitAddArgs,
  gitBranchArgs,
  gitCommitArgs,
  gitPushArgs,
  gitStatusArgs,
  isWorkspacePath,
  parseFindings,
  parseProposal,
  runReadTool,
  sandboxArgv,
  scanSource,
  type ReviewFinding,
} from '@codepilot/tools';
import { resolveWithinRoot } from '@codepilot/security';
import { parseFinancialPeriod } from '@codepilot/indexing';
import { planSearchQuery, mentionedPaths } from './plan-search';
import { runArgv, processPathEnv } from './run-argv';
import { runTaskPhase, type TaskMode, type TaskSnapshot } from './task-run';

const MODES = new Set<TaskMode>(['implement', 'review', 'security', 'docs', 'issue']);
const STATES = new Set<AgentState>([
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
const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export interface TaskExecutor {
  claim: (taskId: string, ownerId: string) => Promise<StoredTask | null>;
  savePhase: (id: string, ownerId: string, update: TaskPhaseUpdate) => Promise<void>;
  addTransition: (taskId: string, from: string | null, to: string, reason: string) => Promise<void>;
  addToolCall: (
    taskId: string,
    name: string,
    status: string,
    durationMs: number,
    error: string | null,
    output: string,
  ) => Promise<void>;
  addChange: (
    taskId: string,
    change: {
      path: string;
      type: string;
      before: string;
      after: string;
      diff: string;
      reason: string;
    },
  ) => Promise<void>;
  addTest: (
    taskId: string,
    test: { command: string; status: string; stdout: string; stderr: string; durationMs: number },
  ) => Promise<void>;
  addFinding: (taskId: string, finding: ReviewFinding) => Promise<void>;
  addPullRequest: (
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
  ) => Promise<void>;
  audit: (entry: {
    userId: string | null;
    action: string;
    repositoryId: string | null;
    taskId: string | null;
    toolName: string | null;
    result: string;
    ip: string | null;
  }) => Promise<void>;
  repository: (
    id: string,
    ownerId: string,
  ) => Promise<{ fullName: string; defaultBranch: string; status: string } | null>;
  token: (ownerId: string) => Promise<string | null>;
  modelConfigured: boolean;
  complete: (
    systemPrompt: string,
    userPrompt: string,
  ) => Promise<
    { text: string; inputTokens: number; outputTokens: number } | { error: string } | null
  >;
  repairLimit: number;
  tokenBudget: number;
  sandboxImage: string;
  inputUsdPerMillion?: number;
  outputUsdPerMillion?: number;
}

export async function executeTaskJob(input: {
  taskId: string;
  ownerId: string;
  storageDir: string;
  store: TaskExecutor;
}): Promise<{ repositoryId: string | null; status: string }> {
  const claimed = await input.store.claim(input.taskId, input.ownerId);
  if (
    !claimed ||
    !MODES.has(claimed.mode as TaskMode) ||
    !STATES.has(claimed.status as AgentState)
  ) {
    return { repositoryId: claimed?.repositoryId ?? null, status: 'skipped' };
  }
  const repository = await input.store.repository(claimed.repositoryId, input.ownerId);
  if (!repository || repository.status !== 'cloned' || !FULL_NAME.test(repository.fullName)) {
    await input.store.savePhase(
      claimed.id,
      input.ownerId,
      failedUpdate(claimed, 'The repository is not cloned.'),
    );
    return { repositoryId: claimed.repositoryId, status: 'FAILED' };
  }
  const clone = resolveWithinRoot(input.storageDir, `${input.ownerId}/${claimed.repositoryId}`);
  const workspace = resolveWithinRoot(
    path.resolve(input.storageDir, '..', 'workspaces'),
    `${input.ownerId}/${claimed.id}`,
  );
  let editsApplied = false;
  const snapshot = toSnapshot(claimed, input.store.modelConfigured);
  const next = await runTaskPhase(snapshot, {
    repairLimit: input.store.repairLimit,
    tokenBudget: input.store.tokenBudget,
    inputUsdPerMillion: input.store.inputUsdPerMillion,
    outputUsdPerMillion: input.store.outputUsdPerMillion,
    ports: {
      inspect: async (task) =>
        inspectRepository(clone, claimed, repository.fullName, task, input.store),
      propose: async (systemPrompt, userPrompt) => {
        const result = await input.store.complete(systemPrompt, userPrompt);
        return result ?? { error: 'The language model request failed.' };
      },
      apply: async (edits) => {
        await copyWorkspace(clone, workspace);
        const changes = [];
        for (const edit of edits) {
          try {
            changes.push(await applyEdit(workspace, edit));
          } catch (error: unknown) {
            const message =
              error instanceof EditError ? error.message : 'The edit could not be applied.';
            return { ok: false as const, message };
          }
        }
        editsApplied = changes.length > 0;
        return { ok: true as const, changes };
      },
      test: () => runSandbox(workspace, input.store.sandboxImage, editsApplied),
      review: (paths) =>
        reviewWorkspace(editsApplied ? workspace : clone, paths, claimed.mode, input.store),
      publish: () =>
        publishWorkspace(
          workspace,
          claimed,
          repository.fullName,
          repository.defaultBranch,
          input.store,
        ),
      parseProposal,
    },
  });
  await persist(input.store, claimed, next);
  return { repositoryId: claimed.repositoryId, status: next.status };
}

async function persist(
  store: TaskExecutor,
  claimed: StoredTask,
  next: TaskSnapshot,
): Promise<void> {
  for (const entry of next.transitions) {
    await store.addTransition(claimed.id, entry.from, entry.to, entry.reason);
  }
  for (const call of next.toolCalls) {
    await store.addToolCall(
      claimed.id,
      call.name,
      call.status,
      call.durationMs,
      call.error,
      call.output,
    );
  }
  for (const change of next.changes) {
    await store.addChange(claimed.id, change);
  }
  for (const test of next.tests) {
    await store.addTest(claimed.id, test);
  }
  for (const finding of next.findings) {
    await store.addFinding(claimed.id, finding);
  }
  if (next.pullRequest) {
    await store.addPullRequest(claimed.id, claimed.repositoryId, {
      githubPrId: next.pullRequest.githubPrId,
      branch: next.pullRequest.branch,
      title: next.pullRequest.title,
      body: next.pullRequest.body,
      url: next.pullRequest.url,
      status: next.pullRequest.status,
    });
  }
  const finished =
    next.status === 'COMPLETED' || next.status === 'FAILED' || next.status === 'CANCELLED';
  await store.savePhase(claimed.id, claimed.createdBy, {
    status: next.status,
    planSource: next.plan?.source ?? null,
    planSteps: next.plan?.steps ?? [],
    edits: next.edits,
    pendingGate: next.pendingGate,
    grantedGate: next.grantedGate,
    repairCount: next.repairCount,
    previousFailureHash: next.previousFailureHash,
    outcome: next.outcome,
    error: next.error,
    inputTokens: next.inputTokens,
    outputTokens: next.outputTokens,
    callCount: next.callCount,
    estimatedCostUsd: next.estimatedCostUsd,
    started: true,
    finished,
  });
  await store.audit({
    userId: claimed.createdBy,
    action: 'task.advance',
    repositoryId: claimed.repositoryId,
    taskId: claimed.id,
    toolName: null,
    result: next.status,
    ip: null,
  });
}

function toSnapshot(task: StoredTask, modelConfigured: boolean): TaskSnapshot {
  const proposal = parseProposal(JSON.stringify({ steps: ['Saved plan.'], edits: task.edits }));
  return {
    title: task.title,
    description: task.description,
    mode: task.mode as TaskMode,
    status: task.status as AgentState,
    plan:
      task.planSteps.length > 0
        ? {
            source: task.planSource === 'model' ? 'model' : 'repository-search',
            steps: task.planSteps,
          }
        : null,
    edits: proposal?.edits ?? [],
    pendingGate:
      task.pendingGate === 'plan' || task.pendingGate === 'git' ? task.pendingGate : null,
    grantedGate:
      task.grantedGate === 'plan' || task.grantedGate === 'git' ? task.grantedGate : null,
    repairCount: task.repairCount,
    previousFailureHash: task.previousFailureHash,
    outcome: task.outcome,
    error: task.error,
    modelConfigured,
    inputTokens: task.inputTokens,
    outputTokens: task.outputTokens,
    callCount: task.callCount,
    estimatedCostUsd: task.estimatedCostUsd,
    changes: [],
    tests: [],
    findings: [],
    pullRequest: null,
    transitions: [],
    toolCalls: [],
  };
}

async function inspectRepository(
  clone: string,
  task: StoredTask,
  fullName: string,
  text: string,
  store: TaskExecutor,
): Promise<{ excerpts: string; steps: string[] }> {
  const search = await runReadTool(clone, 'search_code', {
    query: planSearchQuery(task.title, task.description),
  });
  const structure = await runReadTool(clone, 'get_repository_structure', {});
  let issue = '';
  if (task.mode === 'issue') {
    issue = await readIssue(fullName, text, task.createdBy, store);
  }
  const named = [];
  for (const file of mentionedPaths(task.title, task.description)) {
    const read = await runReadTool(clone, 'read_file', { path: file, startLine: 1, endLine: 80 });
    if (read.ok) {
      named.push(`${file}\n${read.text}`);
    }
  }
  const period = parseFinancialPeriod(`${task.title}\n${task.description}`);
  const periodNote = period
    ? `Requested period: ${period.label} (${period.kind}, ${period.startYear}-${period.endYear}). Do not substitute a different year.`
    : '';
  const excerpts = [issue, periodNote, ...named, search.text, structure.text]
    .filter(Boolean)
    .join('\n')
    .slice(0, 8_000);
  const steps = search.text
    .split('\n')
    .filter((line: string) => line && line !== '(no matches)')
    .slice(0, 5)
    .map((line: string) => `Inspect ${line.slice(0, 180)}`);
  return { excerpts, steps: steps.length > 0 ? steps : ['No readable match was found.'] };
}

async function readIssue(
  fullName: string,
  text: string,
  ownerId: string,
  store: TaskExecutor,
): Promise<string> {
  const match = /#(\d{1,10})\b/u.exec(text);
  const number = match?.[1];
  if (!number) {
    return 'No issue number was included.';
  }
  const token = await store.token(ownerId);
  if (!token) {
    return 'GitHub is not connected for this account.';
  }
  const response = await fetch(`https://api.github.com/repos/${fullName}/issues/${number}`, {
    redirect: 'manual',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'codepilot',
    },
  });
  if (!response.ok || (response.status >= 300 && response.status < 400)) {
    return 'The GitHub issue could not be read.';
  }
  const parsed: unknown = await response.json();
  if (!parsed || typeof parsed !== 'object') {
    return 'The GitHub issue could not be read.';
  }
  const record = parsed as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.slice(0, 200) : '';
  const body = typeof record.body === 'string' ? record.body.slice(0, 2_000) : '';
  return `Issue ${number}: ${title}\n${body}`;
}

async function copyWorkspace(clone: string, workspace: string): Promise<void> {
  await rm(workspace, { recursive: true, force: true });
  await mkdir(path.dirname(workspace), { recursive: true });
  await cp(clone, workspace, { recursive: true, verbatimSymlinks: true });
}

async function runSandbox(
  workspace: string,
  image: string,
  editsApplied: boolean,
): Promise<{
  status: 'passed' | 'failed' | 'not_run' | 'blocked';
  command: string;
  stdout: string;
  stderr: string;
  durationMs: number;
}> {
  if (!editsApplied) {
    return {
      status: 'not_run',
      command: 'npm test',
      stdout: '',
      stderr: 'No files were changed.',
      durationMs: 0,
    };
  }
  try {
    await access(path.join(workspace, 'package.json'));
  } catch {
    return {
      status: 'not_run',
      command: 'npm test',
      stdout: '',
      stderr: 'This repository has no package.json, so tests were skipped.',
      durationMs: 0,
    };
  }
  const argv = sandboxArgv('run_tests', {});
  const docker = argv ? dockerRunArgs(image, workspace, argv) : null;
  if (!docker) {
    return {
      status: 'blocked',
      command: 'npm test',
      stdout: '',
      stderr: 'The sandbox command was rejected.',
      durationMs: 0,
    };
  }
  const started = Date.now();
  const result = await runArgv('docker', docker.slice(1), {
    cwd: workspace,
    env: processPathEnv(),
    timeoutMs: 120_000,
  });
  const durationMs = Date.now() - started;
  if (result.missing) {
    return {
      status: 'blocked',
      command: 'docker run',
      stdout: '',
      stderr: 'The sandbox is not available.',
      durationMs,
    };
  }
  if (result.timedOut) {
    return {
      status: 'failed',
      command: 'npm test',
      stdout: result.stdout,
      stderr: 'The sandbox timed out.',
      durationMs,
    };
  }
  return {
    status: result.code === 0 ? 'passed' : 'failed',
    command: 'npm test',
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs,
  };
}

async function reviewWorkspace(
  workspace: string,
  paths: readonly string[],
  mode: string,
  store: TaskExecutor,
): Promise<ReviewFinding[]> {
  const files = [];
  for (const relative of paths) {
    if (!isWorkspacePath(relative)) {
      continue;
    }
    try {
      const content = await readFile(resolveWithinRoot(workspace, relative), 'utf8');
      files.push({ path: relative, content: content.slice(0, 20_000) });
    } catch {
      continue;
    }
  }
  const findings = scanSource(files);
  if ((mode === 'security' || mode === 'review') && files.length === 0) {
    const listed = await runReadTool(workspace, 'list_files', {});
    const extra = listed.text
      .split('\n')
      .filter(
        (line: string) => line.endsWith('.ts') || line.endsWith('.js') || line.endsWith('.py'),
      )
      .slice(0, 20);
    for (const relative of extra) {
      try {
        const content = await readFile(resolveWithinRoot(workspace, relative), 'utf8');
        findings.push(...scanSource([{ path: relative, content: content.slice(0, 20_000) }]));
      } catch {
        continue;
      }
    }
  }
  if (store.modelConfigured && (mode === 'security' || mode === 'review')) {
    const model = await store.complete(
      'Report security findings as JSON {"findings":[]}. Do not change files.',
      `Untrusted repository data:\n${files.map((file) => file.path).join('\n')}`.slice(0, 4_000),
    );
    if (model && !('error' in model)) {
      const parsed = parseFindings(model.text);
      if (parsed) {
        findings.push(...parsed);
      }
    }
  }
  return findings.slice(0, 50);
}

async function publishWorkspace(
  workspace: string,
  task: StoredTask,
  fullName: string,
  base: string,
  store: TaskExecutor,
): Promise<
  | {
      ok: true;
      url: string;
      githubPrId: number | null;
      branch: string;
      title: string;
      body: string;
    }
  | { ok: false; message: string }
> {
  const token = await store.token(task.createdBy);
  if (!token) {
    return { ok: false, message: 'GitHub is not connected for this account.' };
  }
  const branch = `codepilot/${task.id.replaceAll('-', '').slice(0, 12)}`;
  const branchArgs = gitBranchArgs(branch);
  const commitArgs = gitCommitArgs(task.title);
  if (!branchArgs || !commitArgs) {
    return { ok: false, message: 'The branch name was rejected.' };
  }
  const env = gitCommandEnv(token);
  const status = await runArgv('git', gitStatusArgs().slice(1), {
    cwd: workspace,
    env,
    timeoutMs: 30_000,
  });
  const paths = porcelainPaths(status.stdout);
  const addArgs = gitAddArgs(paths);
  const pushArgs = gitPushArgs(branch, true);
  if (!addArgs || !pushArgs) {
    return { ok: false, message: 'There are no changes to publish.' };
  }
  const created = await runArgv('git', branchArgs.slice(1), {
    cwd: workspace,
    env,
    timeoutMs: 30_000,
  });
  if (created.code !== 0) {
    return { ok: false, message: 'The branch could not be created.' };
  }
  const added = await runArgv('git', addArgs.slice(1), { cwd: workspace, env, timeoutMs: 30_000 });
  if (added.code !== 0) {
    return { ok: false, message: 'The changes could not be staged.' };
  }
  const committed = await runArgv('git', commitArgs.slice(1), {
    cwd: workspace,
    env,
    timeoutMs: 30_000,
  });
  if (committed.code !== 0) {
    return { ok: false, message: 'The commit could not be created.' };
  }
  const authenticated = gitCommandEnv(token);
  const localGit = gitCommandEnv(null);
  let pushed = await runArgv('git', pushArgs.slice(1), {
    cwd: workspace,
    env: authenticated,
    timeoutMs: 60_000,
  });
  if (pushed.code !== 0) {
    const fallback = gitPushArgs(branch, false);
    pushed = await runArgv('git', fallback?.slice(1) ?? pushArgs.slice(1), {
      cwd: workspace,
      env: localGit,
      timeoutMs: 60_000,
    });
  }
  if (pushed.code !== 0) {
    return { ok: false, message: 'The branch could not be pushed.' };
  }
  const response = await github(token, `https://api.github.com/repos/${fullName}/pulls`, {
    title: task.title,
    head: branch,
    base,
    body: task.description.slice(0, 8_000),
  });
  if (!response.ok) {
    return {
      ok: false,
      message:
        response.status === 401 || response.status === 403
          ? 'GitHub rejected the saved sign-in. Sign out, sign in again, and create a new task.'
          : 'The pull request could not be opened.',
    };
  }
  return {
    ok: true,
    url: response.url,
    githubPrId: response.number,
    branch,
    title: task.title,
    body: task.description.slice(0, 8_000),
  };
}

function gitCommandEnv(token: string | null): NodeJS.ProcessEnv {
  const env = processPathEnv();
  env.GIT_TERMINAL_PROMPT = '0';
  if (token) {
    env.GIT_CONFIG_COUNT = '1';
    env.GIT_CONFIG_KEY_0 = 'http.extraheader';
    env.GIT_CONFIG_VALUE_0 = `Authorization: Bearer ${token}`;
  }
  return env;
}

function porcelainPaths(stdout: string): string[] {
  const paths: string[] = [];
  for (const line of stdout.split('\n')) {
    const relative = line.slice(3).trim();
    if (isWorkspacePath(relative)) {
      paths.push(relative);
    }
  }
  return paths.slice(0, 8);
}

async function github(
  token: string,
  url: string,
  body: Record<string, string>,
): Promise<{ ok: true; url: string; number: number | null } | { ok: false; status: number }> {
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'codepilot',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok || (response.status >= 300 && response.status < 400)) {
    return { ok: false, status: response.status };
  }
  const parsed: unknown = await response.json();
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, status: response.status };
  }
  const record = parsed as Record<string, unknown>;
  const html = typeof record.html_url === 'string' ? record.html_url : '';
  if (!html.startsWith('https://github.com/')) {
    return { ok: false, status: response.status };
  }
  const number =
    typeof record.number === 'number' && Number.isInteger(record.number) ? record.number : null;
  return { ok: true, url: html, number };
}

function failedUpdate(task: StoredTask, message: string): TaskPhaseUpdate {
  return {
    status: 'FAILED',
    planSource: task.planSource,
    planSteps: task.planSteps,
    edits: task.edits,
    pendingGate: null,
    grantedGate: task.grantedGate,
    repairCount: task.repairCount,
    previousFailureHash: task.previousFailureHash,
    outcome: 'failed',
    error: message,
    inputTokens: task.inputTokens,
    outputTokens: task.outputTokens,
    callCount: task.callCount,
    estimatedCostUsd: task.estimatedCostUsd,
    started: true,
    finished: true,
  };
}
