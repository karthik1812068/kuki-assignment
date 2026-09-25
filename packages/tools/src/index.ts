import { TOOL_DEFINITIONS } from './definitions';

export { TOOL_DEFINITIONS } from './definitions';
export type { ToolDefinition, ToolField } from './definitions';
export { applyEdit, EditError } from './edits';
export type { AppliedEdit } from './edits';
export { unifiedDiff } from './diff';
export {
  gitAddArgs,
  gitBranchArgs,
  gitCommitArgs,
  gitDiffArgs,
  gitPushArgs,
  gitStatusArgs,
  isSafeBranch,
} from './git-args';
export { summarizeTasks } from './metrics';
export type { MeasuredTask, TaskMeasurements } from './metrics';
export { TOOL_PERMISSIONS } from './permissions';
export type { ToolPermission } from './permissions';
export { isWorkspacePath, parseFindings, parseProposal } from './proposal';
export type { ProposedEdit, ReviewFinding } from './proposal';
export { runReadTool } from './read-tools';
export type { ReadToolResult } from './read-tools';
export { scanSource } from './review';
export { dockerRunArgs, sandboxArgv } from './sandbox-args';
export { getToolDefinition, validateToolInput } from './validate';
export type { ToolInputResult } from './validate';

/** Read tools run against a workspace. Writes, sandbox, git, and GitHub run only after approval. */
export const toolRuntime = { implemented: true, arbitraryShell: false } as const;

export const PLANNED_TOOLS = TOOL_DEFINITIONS;

export function getPlannedTool(name: string): (typeof PLANNED_TOOLS)[number] | undefined {
  return PLANNED_TOOLS.find((entry) => entry.name === name);
}
