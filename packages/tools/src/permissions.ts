export const TOOL_PERMISSIONS = ['READ', 'WRITE', 'EXECUTE', 'GIT', 'GITHUB'] as const;

export type ToolPermission = (typeof TOOL_PERMISSIONS)[number];
