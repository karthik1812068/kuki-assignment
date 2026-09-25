import { TOOL_DEFINITIONS, type ToolDefinition, type ToolField } from './definitions';

export type ToolInputResult =
  | {
      ok: true;
      tool: ToolDefinition;
      input: Record<string, string | number | boolean>;
    }
  | { ok: false; code: 'UNKNOWN_TOOL' | 'INVALID_INPUT' };

export function validateToolInput(name: string, value: unknown): ToolInputResult {
  const tool = TOOL_DEFINITIONS.find((entry) => entry.name === name);
  if (!tool) {
    return { ok: false, code: 'UNKNOWN_TOOL' };
  }
  const input = readInput(tool.input, value);
  if (!input) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  const start = input.startLine;
  const end = input.endLine;
  if (typeof start === 'number' && typeof end === 'number' && end < start) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  return { ok: true, tool, input };
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((entry) => entry.name === name);
}

function readInput(
  fields: readonly ToolField[],
  value: unknown,
): Record<string, string | number | boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(fields.map((field) => field.name));
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return null;
    }
  }
  const input: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    const raw = record[field.name];
    if (raw === undefined) {
      if (field.required) {
        return null;
      }
      continue;
    }
    const parsed = readField(field, raw);
    if (parsed === undefined) {
      return null;
    }
    input[field.name] = parsed;
  }
  return input;
}

function readField(field: ToolField, value: unknown): string | number | boolean | undefined {
  if (field.type === 'boolean') {
    return typeof value === 'boolean' ? value : undefined;
  }
  if (field.type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return undefined;
    }
    if (field.minimum !== undefined && value < field.minimum) {
      return undefined;
    }
    if (field.maximum !== undefined && value > field.maximum) {
      return undefined;
    }
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    return undefined;
  }
  if (hasControl(value)) {
    return undefined;
  }
  if (field.kind === 'path') {
    return isSafePath(value) ? value : undefined;
  }
  if (field.kind === 'branch') {
    return isBranch(value) ? value : undefined;
  }
  if (value.trim().length === 0) {
    return undefined;
  }
  return value;
}

function isSafePath(value: string): boolean {
  if (
    value.length === 0 ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('://')
  ) {
    return false;
  }
  return value
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function isBranch(value: string): boolean {
  return /^[A-Za-z0-9._/-]{1,100}$/.test(value) && !value.startsWith('-') && !value.includes('..');
}

function hasControl(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) <= 31) {
      return true;
    }
  }
  return false;
}
