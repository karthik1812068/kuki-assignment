import { isIgnoredRepositoryPath, isSecretRepositoryPath } from '@codepilot/security';

export interface ProposedEdit {
  path: string;
  type: 'create' | 'write' | 'edit' | 'delete';
  content?: string;
  oldText?: string;
  newText?: string;
  reason: string;
}

export interface ReviewFinding {
  severity: 'low' | 'medium' | 'high';
  path: string;
  line: number | null;
  problem: string;
  explanation: string;
  recommendation: string;
  source: 'static' | 'model';
}

const EDIT_TYPES = new Set(['create', 'write', 'edit', 'delete']);
const EDIT_TYPE_ALIASES: Record<string, ProposedEdit['type']> = {
  replace: 'edit',
  update: 'edit',
  modify: 'edit',
};
const SEVERITIES = new Set(['low', 'medium', 'high']);

export function parseProposal(raw: string): { steps: string[]; edits: ProposedEdit[] } | null {
  const parsed = readJson(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.steps) || record.steps.length === 0 || record.steps.length > 12) {
    return null;
  }
  const steps: string[] = [];
  for (const step of record.steps) {
    if (typeof step !== 'string') {
      return null;
    }
    const clean = cleanText(step, 300);
    if (!clean) {
      return null;
    }
    steps.push(clean);
  }
  if (!Array.isArray(record.edits) || record.edits.length > 8) {
    return null;
  }
  const edits: ProposedEdit[] = [];
  for (const entry of record.edits) {
    const edit = readEdit(entry);
    if (!edit) {
      return null;
    }
    edits.push(edit);
  }
  return { steps, edits };
}

export function parseFindings(raw: string): ReviewFinding[] | null {
  const parsed = readJson(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const findings = (parsed as Record<string, unknown>).findings;
  if (!Array.isArray(findings) || findings.length > 20) {
    return null;
  }
  const result: ReviewFinding[] = [];
  for (const entry of findings) {
    const finding = readFinding(entry);
    if (!finding) {
      return null;
    }
    result.push(finding);
  }
  return result;
}

export function isWorkspacePath(filePath: string): boolean {
  if (filePath.length === 0 || filePath.length > 300) {
    return false;
  }
  if (
    filePath.startsWith('/') ||
    filePath.startsWith('-') ||
    filePath.includes('\\') ||
    filePath.includes('\0') ||
    filePath.includes('://')
  ) {
    return false;
  }
  const segments = filePath.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    return false;
  }
  return !isIgnoredRepositoryPath(filePath) && !isSecretRepositoryPath(filePath);
}

function readEdit(value: unknown): ProposedEdit | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.path !== 'string' || typeof record.type !== 'string') {
    return null;
  }
  const type = EDIT_TYPE_ALIASES[record.type] ?? (record.type as ProposedEdit['type']);
  if (!EDIT_TYPES.has(type) || !isWorkspacePath(record.path)) {
    return null;
  }
  const reason = typeof record.reason === 'string' ? cleanText(record.reason, 300) : '';
  if (!reason) {
    return null;
  }
  if (type === 'delete') {
    return { path: record.path, type, reason };
  }
  if (type === 'edit') {
    const oldText = typeof record.oldText === 'string' ? cleanText(record.oldText, 8_000) : '';
    const newText = typeof record.newText === 'string' ? cleanText(record.newText, 8_000) : '';
    if (newText.length === 0) {
      return null;
    }
    if (!oldText) {
      return { path: record.path, type, oldText: '', newText, reason };
    }
    return { path: record.path, type, oldText, newText, reason };
  }
  const content = typeof record.content === 'string' ? cleanText(record.content, 20_000) : '';
  if (!content) {
    return null;
  }
  return { path: record.path, type, content, reason };
}

function readFinding(value: unknown): ReviewFinding | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.severity !== 'string' || !SEVERITIES.has(record.severity)) {
    return null;
  }
  if (typeof record.path !== 'string' || !isWorkspacePath(record.path)) {
    return null;
  }
  const line =
    record.line === null || record.line === undefined
      ? null
      : typeof record.line === 'number' && Number.isInteger(record.line) && record.line > 0
        ? record.line
        : undefined;
  if (line === undefined) {
    return null;
  }
  const problem = typeof record.problem === 'string' ? cleanText(record.problem, 300) : '';
  const explanation =
    typeof record.explanation === 'string' ? cleanText(record.explanation, 300) : '';
  const recommendation =
    typeof record.recommendation === 'string' ? cleanText(record.recommendation, 300) : '';
  if (!problem || !explanation || !recommendation) {
    return null;
  }
  return {
    severity: record.severity as ReviewFinding['severity'],
    path: record.path,
    line,
    problem,
    explanation,
    recommendation,
    source: 'model',
  };
}

function readJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/u.exec(trimmed);
  try {
    return JSON.parse(fenced?.[1] ?? trimmed) as unknown;
  } catch {
    return null;
  }
}

function cleanText(value: string, max: number): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 31 || char === '\n' || char === '\t') {
      result += char;
    }
    if (result.length >= max) {
      break;
    }
  }
  return result.trim();
}
