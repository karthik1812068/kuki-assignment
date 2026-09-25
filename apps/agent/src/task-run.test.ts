import { describe, expect, it } from 'vitest';
import type { ProposedEdit } from '@codepilot/tools';
import { runTaskPhase, type TaskPorts, type TaskSnapshot } from './task-run';

function snapshot(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    title: 'Update greeting',
    description: 'Change the greeting text.',
    mode: 'implement',
    status: 'CREATED',
    plan: null,
    edits: [],
    pendingGate: null,
    grantedGate: null,
    repairCount: 0,
    previousFailureHash: null,
    outcome: null,
    error: null,
    modelConfigured: false,
    inputTokens: 0,
    outputTokens: 0,
    callCount: 0,
    estimatedCostUsd: null,
    changes: [],
    tests: [],
    findings: [],
    pullRequest: null,
    transitions: [],
    toolCalls: [],
    ...overrides,
  };
}

function ports(overrides: Partial<TaskPorts> = {}): TaskPorts {
  return {
    inspect: () =>
      Promise.resolve({ excerpts: 'app.ts:1:return "hi"', steps: ['Inspect app.ts.'] }),
    propose: () => Promise.resolve({ error: 'The language model request failed.' }),
    apply: (edits) =>
      Promise.resolve({
        ok: true,
        changes: edits.map((edit) => ({
          path: edit.path,
          type: edit.type,
          before: 'return "hi";',
          after: 'return "hello";',
          diff: '--- a/app.ts\n+++ b/app.ts\n-return "hi";\n+return "hello";\n',
          reason: edit.reason,
        })),
      }),
    test: () =>
      Promise.resolve({
        status: 'not_run',
        command: 'npm test',
        stdout: '',
        stderr: '',
        durationMs: 0,
      }),
    review: () => Promise.resolve([]),
    publish: () =>
      Promise.resolve({
        ok: true,
        url: 'https://github.com/acme/app/pull/3',
        githubPrId: 3,
        branch: 'codepilot/task',
        title: 'Update greeting',
        body: 'Approved change.',
      }),
    parseProposal: (raw) => {
      const parsed = JSON.parse(raw) as { steps: string[]; edits: ProposedEdit[] };
      return parsed;
    },
    ...overrides,
  };
}

describe('runTaskPhase', () => {
  it('stops after a repository-search plan until the plan is approved', async () => {
    const planned = await runTaskPhase(snapshot(), {
      repairLimit: 3,
      tokenBudget: 20_000,
      ports: ports(),
    });
    expect(planned.status).toBe('WAITING_FOR_APPROVAL');
    expect(planned.pendingGate).toBe('plan');
    expect(planned.plan?.source).toBe('repository-search');
    expect(planned.edits).toHaveLength(0);

    const finished = await runTaskPhase(
      { ...planned, grantedGate: 'plan' },
      { repairLimit: 3, tokenBudget: 20_000, ports: ports() },
    );
    expect(finished.status).toBe('COMPLETED');
    expect(finished.outcome).toBe('inspection_only');
    expect(finished.changes).toHaveLength(0);
  });

  it('applies an approved edit, then waits again before publishing', async () => {
    const modelPorts = ports({
      propose: () =>
        Promise.resolve({
          text: JSON.stringify({
            steps: ['Change the greeting.'],
            edits: [
              {
                path: 'app.ts',
                type: 'edit',
                oldText: 'return "hi";',
                newText: 'return "hello";',
                reason: 'Use the requested greeting.',
              },
            ],
          }),
          inputTokens: 20,
          outputTokens: 30,
        }),
      test: () =>
        Promise.resolve({
          status: 'passed',
          command: 'npm test',
          stdout: 'ok',
          stderr: '',
          durationMs: 12,
        }),
    });
    const planned = await runTaskPhase(snapshot({ modelConfigured: true }), {
      repairLimit: 3,
      tokenBudget: 20_000,
      inputUsdPerMillion: 1,
      outputUsdPerMillion: 2,
      ports: modelPorts,
    });
    expect(planned.edits).toHaveLength(1);
    expect(planned.estimatedCostUsd).toBe(0.00008);

    const ready = await runTaskPhase(
      { ...planned, grantedGate: 'plan' },
      { repairLimit: 3, tokenBudget: 20_000, ports: modelPorts },
    );
    expect(ready.status).toBe('WAITING_FOR_APPROVAL');
    expect(ready.pendingGate).toBe('git');
    expect(ready.changes).toHaveLength(1);

    const published = await runTaskPhase(
      { ...ready, grantedGate: 'git' },
      { repairLimit: 3, tokenBudget: 20_000, ports: modelPorts },
    );
    expect(published.status).toBe('COMPLETED');
    expect(published.outcome).toBe('pull_request');
    expect(published.pullRequest?.url).toBe('https://github.com/acme/app/pull/3');
  });

  it('stops when the same sandbox failure repeats', async () => {
    let calls = 0;
    const failing = ports({
      propose: () => {
        calls += 1;
        return Promise.resolve({
          text: JSON.stringify({
            steps: ['Try a fix.'],
            edits: [
              {
                path: 'app.ts',
                type: 'edit',
                oldText: 'return "hi";',
                newText: 'return "hello";',
                reason: 'Attempt a fix.',
              },
            ],
          }),
          inputTokens: 1,
          outputTokens: 1,
        });
      },
      test: () =>
        Promise.resolve({
          status: 'failed',
          command: 'npm test',
          stdout: '',
          stderr: 'same failure',
          durationMs: 5,
        }),
    });
    const planned = await runTaskPhase(snapshot({ modelConfigured: true }), {
      repairLimit: 3,
      tokenBudget: 20_000,
      ports: failing,
    });
    const failed = await runTaskPhase(
      { ...planned, grantedGate: 'plan' },
      { repairLimit: 3, tokenBudget: 20_000, ports: failing },
    );
    expect(failed.status).toBe('FAILED');
    expect(failed.error).toBe('The same sandbox failure repeated.');
    expect(calls).toBeGreaterThan(1);
  });
});
