import { describe, expect, it } from 'vitest';
import {
  PLANNED_TOOLS,
  TOOL_PERMISSIONS,
  getPlannedTool,
  toolRuntime,
  validateToolInput,
} from './index';

describe('planned tools', () => {
  it('publishes the product tool catalog without implementations', () => {
    expect(toolRuntime.implemented).toBe(true);
    expect(toolRuntime.arbitraryShell).toBe(false);
    expect(PLANNED_TOOLS).toHaveLength(25);
    expect(new Set(PLANNED_TOOLS.map((entry) => entry.name)).size).toBe(PLANNED_TOOLS.length);

    for (const permission of TOOL_PERMISSIONS) {
      expect(PLANNED_TOOLS.some((entry) => entry.permission === permission)).toBe(true);
    }

    for (const entry of PLANNED_TOOLS) {
      expect(entry.timeoutMs).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }

    expect(getPlannedTool('read_file')?.permission).toBe('READ');
    expect(getPlannedTool('delete_file')?.permission).toBe('WRITE');
    expect(getPlannedTool('run_tests')?.permission).toBe('EXECUTE');
    expect(getPlannedTool('push_changes')?.permission).toBe('GIT');
    expect(getPlannedTool('create_pull_request')?.permission).toBe('GITHUB');
    expect(getPlannedTool('missing')).toBeUndefined();
    expect(PLANNED_TOOLS.every((entry) => entry.errors.includes('NOT_IMPLEMENTED'))).toBe(true);
    expect(getPlannedTool('read_file')?.requiresApproval).toBe(false);
    expect(getPlannedTool('delete_file')?.requiresApproval).toBe(true);
  });

  it('validates tool input and rejects a shell tool', () => {
    expect(toolRuntime.implemented).toBe(true);
    expect(toolRuntime.arbitraryShell).toBe(false);
    expect(
      validateToolInput('read_file', { path: 'src/auth.ts', startLine: 1, endLine: 4 }).ok,
    ).toBe(true);
    expect(validateToolInput('read_file', { path: '../.env' }).ok).toBe(false);
    expect(validateToolInput('search_code', {}).ok).toBe(false);
    expect(validateToolInput('run_shell', { command: 'rm -rf /' })).toEqual({
      ok: false,
      code: 'UNKNOWN_TOOL',
    });
  });
});
