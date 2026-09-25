import type { ToolPermission } from './permissions';

export interface ToolField {
  name: string;
  type: 'string' | 'integer' | 'boolean';
  required: boolean;
  kind?: 'path' | 'branch' | 'text';
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  permission: ToolPermission;
  timeoutMs: number;
  requiresApproval: boolean;
  input: readonly ToolField[];
  errors: readonly ['INVALID_INPUT', 'NOT_IMPLEMENTED'];
}

const ERRORS = ['INVALID_INPUT', 'NOT_IMPLEMENTED'] as const;

const TIMEOUT_MS: Record<ToolPermission, number> = {
  READ: 15_000,
  WRITE: 15_000,
  EXECUTE: 120_000,
  GIT: 60_000,
  GITHUB: 30_000,
};

function pathField(required: boolean): ToolField {
  return { name: 'path', type: 'string', required, kind: 'path', maxLength: 300 };
}

function textField(name: string, maxLength: number, required = true): ToolField {
  return { name, type: 'string', required, kind: 'text', maxLength };
}

function tool(
  name: string,
  description: string,
  permission: ToolPermission,
  input: readonly ToolField[],
): ToolDefinition {
  return {
    name,
    description,
    permission,
    timeoutMs: TIMEOUT_MS[permission],
    requiresApproval: permission !== 'READ',
    input,
    errors: ERRORS,
  };
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  tool('list_files', 'List files in the repository.', 'READ', [pathField(false)]),
  tool('read_file', 'Read a file or a line range from the repository.', 'READ', [
    pathField(true),
    { name: 'startLine', type: 'integer', required: false, minimum: 1, maximum: 100_000 },
    { name: 'endLine', type: 'integer', required: false, minimum: 1, maximum: 100_000 },
  ]),
  tool('search_code', 'Search repository text.', 'READ', [textField('query', 200)]),
  tool('search_symbol', 'Search symbols in the repository index.', 'READ', [
    textField('query', 200),
  ]),
  tool('find_function', 'Find a function definition.', 'READ', [textField('name', 120)]),
  tool('find_class', 'Find a class definition.', 'READ', [textField('name', 120)]),
  tool('get_repository_structure', 'Summarize the repository tree.', 'READ', [pathField(false)]),
  tool('create_file', 'Create a new file.', 'WRITE', [
    pathField(true),
    textField('content', 20_000),
  ]),
  tool('write_file', 'Replace the contents of a file.', 'WRITE', [
    pathField(true),
    textField('content', 20_000),
  ]),
  tool('edit_file', 'Apply an edit to a file.', 'WRITE', [
    pathField(true),
    textField('oldText', 8_000),
    textField('newText', 8_000),
  ]),
  tool('delete_file', 'Delete a file.', 'WRITE', [pathField(true)]),
  tool('run_tests', 'Run the repository test suite in the sandbox.', 'EXECUTE', []),
  tool('run_test_file', 'Run one test file in the sandbox.', 'EXECUTE', [pathField(true)]),
  tool('run_linter', 'Run the linter in the sandbox.', 'EXECUTE', []),
  tool('run_typecheck', 'Run the type checker in the sandbox.', 'EXECUTE', []),
  tool('run_build', 'Run the build in the sandbox.', 'EXECUTE', []),
  tool('git_status', 'Show git status for the workspace.', 'GIT', []),
  tool('git_diff', 'Show the git diff for the workspace.', 'GIT', [pathField(false)]),
  tool('create_branch', 'Create a git branch.', 'GIT', [
    { name: 'branch', type: 'string', required: true, kind: 'branch', maxLength: 100 },
  ]),
  tool('commit_changes', 'Create a git commit.', 'GIT', [textField('message', 200)]),
  tool('push_changes', 'Push the current branch.', 'GIT', []),
  tool('get_issue', 'Read a GitHub issue.', 'GITHUB', [
    { name: 'number', type: 'integer', required: true, minimum: 1, maximum: 1_000_000_000 },
  ]),
  tool('create_pull_request', 'Open a GitHub pull request.', 'GITHUB', [
    textField('title', 200),
    textField('body', 8_000),
  ]),
  tool('get_pull_request', 'Read a GitHub pull request.', 'GITHUB', [
    { name: 'number', type: 'integer', required: true, minimum: 1, maximum: 1_000_000_000 },
  ]),
  tool('comment_on_pull_request', 'Comment on a GitHub pull request.', 'GITHUB', [
    { name: 'number', type: 'integer', required: true, minimum: 1, maximum: 1_000_000_000 },
    textField('body', 8_000),
  ]),
];
