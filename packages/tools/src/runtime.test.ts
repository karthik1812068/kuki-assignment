import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyEdit } from './edits';
import { dockerRunArgs, sandboxArgv } from './sandbox-args';
import { gitBranchArgs, gitCommitArgs, gitPushArgs } from './git-args';
import { summarizeTasks } from './metrics';
import { parseProposal } from './proposal';
import { runReadTool } from './read-tools';
import { scanSource } from './review';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('repository tools', () => {
  it('reads source and skips a secret file', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codepilot-tools-'));
    roots.push(root);
    await writeFile(path.join(root, 'app.ts'), 'export function greet() {\n  return "hi";\n}\n');
    await writeFile(path.join(root, '.env'), 'TOKEN=secret\n');

    const read = await runReadTool(root, 'read_file', { path: 'app.ts', startLine: 1, endLine: 2 });
    expect(read.ok).toBe(true);
    expect(read.text).toContain('greet');
    const secret = await runReadTool(root, 'read_file', { path: '.env' });
    expect(secret.ok).toBe(false);
    expect(secret.text).not.toContain('TOKEN=secret');
    const found = await runReadTool(root, 'find_function', { name: 'greet' });
    expect(found.text).toContain('app.ts:1:');
  });

  it('applies one exact edit and records a diff', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codepilot-edit-'));
    roots.push(root);
    await writeFile(path.join(root, 'app.ts'), 'return 1;\n');
    const applied = await applyEdit(root, {
      path: 'app.ts',
      type: 'edit',
      oldText: 'return 1;',
      newText: 'return 2;',
      reason: 'Update the return value.',
    });
    expect(applied.diff).toContain('-return 1;');
    expect(applied.diff).toContain('+return 2;');
    expect(await readFile(path.join(root, 'app.ts'), 'utf8')).toBe('return 2;\n');
    const appended = await applyEdit(root, {
      path: 'app.ts',
      type: 'edit',
      oldText: '',
      newText: 'A short project note.',
      reason: 'Add the note.',
    });
    expect(appended.diff).toContain('+A short project note.');
    expect(await readFile(path.join(root, 'app.ts'), 'utf8')).toBe(
      'return 2;\nA short project note.\n',
    );
    await writeFile(path.join(root, 'README.md'), '# Title\r\nHello\r\n', 'utf8');
    await applyEdit(root, {
      path: 'README.md',
      type: 'edit',
      oldText: '# Title\nHello',
      newText: '# Title\nHello\nA note.',
      reason: 'Add the note.',
    });
    expect(await readFile(path.join(root, 'README.md'), 'utf8')).toBe(
      '# Title\r\nHello\r\nA note.\r\n',
    );
    await expect(
      applyEdit(root, { path: '../.env', type: 'delete', reason: 'no' }),
    ).rejects.toThrow('That path is not available.');
  });

  it('parses a fenced proposal and drops an unsafe path', () => {
    expect(
      parseProposal(
        '```json\n{"steps":["Change the return."],"edits":[{"path":"app.ts","type":"edit","oldText":"return 1;","newText":"return 2;","reason":"Update it."}]}\n```',
      )?.edits,
    ).toHaveLength(1);
    expect(
      parseProposal('{"steps":["x"],"edits":[{"path":"../.env","type":"delete","reason":"no"}]}'),
    ).toBeNull();
    expect(
      parseProposal(
        '{"steps":["Add a sentence."],"edits":[{"path":"README.md","type":"edit","oldText":"","newText":"A short project note.","reason":"Add the note."}]}',
      )?.edits[0],
    ).toMatchObject({ type: 'edit', oldText: '', newText: 'A short project note.' });
  });

  it('builds a network-disabled sandbox command and a safe branch', () => {
    const args = dockerRunArgs(
      'node:22-bookworm-slim',
      path.resolve('/work/repo'),
      sandboxArgv('run_tests', {}) ?? [],
    );
    expect(args).toContain('--network');
    expect(args).toContain('none');
    expect(args?.join(' ')).not.toContain('sh -c');
    expect(gitBranchArgs('-main')).toBeNull();
    expect(gitCommitArgs('Update greeting')).toContain('Update greeting');
    expect(gitPushArgs('codepilot/abc123', true)?.slice(0, 3)).toEqual([
      'git',
      '-c',
      'credential.helper=',
    ]);
  });

  it('reports a static finding and only measured task numbers', () => {
    const findings = scanSource([{ path: 'app.ts', content: 'eval(input)\n' }]);
    expect(findings[0]?.problem).toBe('eval call');
    const summary = summarizeTasks([
      {
        status: 'COMPLETED',
        startedAt: '2026-09-24T00:00:00.000Z',
        completedAt: '2026-09-24T00:00:02.000Z',
        inputTokens: 10,
        outputTokens: 4,
        estimatedCostUsd: null,
      },
    ]);
    expect(summary.completed).toBe(1);
    expect(summary.averageDurationMs).toBe(2000);
    expect(summary.estimatedCostUsd).toBeNull();
    expect(summary.inputTokens).toBe(10);
  });
});
