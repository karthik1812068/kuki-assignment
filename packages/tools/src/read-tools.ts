import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isIgnoredRepositoryPath, isSecretRepositoryPath } from '@codepilot/security';
import { validateToolInput } from './validate';
import { isWorkspacePath } from './proposal';

const MAX_FILES = 400;
const MAX_LIST = 200;
const MAX_HITS = 20;
const MAX_DEPTH = 8;

export interface ReadToolResult {
  ok: boolean;
  text: string;
  code?: 'INVALID_INPUT' | 'NOT_FOUND' | 'UNAVAILABLE';
}

export async function runReadTool(
  root: string,
  name: string,
  value: unknown,
): Promise<ReadToolResult> {
  const parsed = validateToolInput(name, value);
  if (!parsed.ok || parsed.tool.permission !== 'READ') {
    return { ok: false, code: 'INVALID_INPUT', text: 'The tool input is not valid.' };
  }
  const relative = typeof parsed.input.path === 'string' ? parsed.input.path : '';
  if (relative && !isWorkspacePath(relative)) {
    return { ok: false, code: 'UNAVAILABLE', text: 'That path is not available.' };
  }
  if (name === 'list_files' || name === 'get_repository_structure') {
    const paths = await walk(root, relative, name === 'get_repository_structure' ? 3 : MAX_DEPTH);
    const lines = paths.slice(0, MAX_LIST);
    return { ok: true, text: lines.join('\n') || '(empty)' };
  }
  if (name === 'read_file') {
    return readRange(
      root,
      relative,
      typeof parsed.input.startLine === 'number' ? parsed.input.startLine : 1,
      typeof parsed.input.endLine === 'number' ? parsed.input.endLine : undefined,
    );
  }
  const query =
    typeof parsed.input.query === 'string'
      ? parsed.input.query
      : typeof parsed.input.name === 'string'
        ? parsed.input.name
        : '';
  const hits = await search(root, query, name);
  return { ok: true, text: hits.join('\n') || '(no matches)' };
}

async function readRange(
  root: string,
  relative: string,
  startLine: number,
  endLine: number | undefined,
): Promise<ReadToolResult> {
  if (!isWorkspacePath(relative)) {
    return { ok: false, code: 'UNAVAILABLE', text: 'That path is not available.' };
  }
  const absolute = path.resolve(root, relative);
  if (!inside(root, absolute)) {
    return { ok: false, code: 'UNAVAILABLE', text: 'That path is not available.' };
  }
  let info;
  try {
    info = await lstat(absolute);
  } catch {
    return { ok: false, code: 'NOT_FOUND', text: 'The file was not found.' };
  }
  if (!info.isFile() || info.isSymbolicLink()) {
    return { ok: false, code: 'UNAVAILABLE', text: 'That path is not available.' };
  }
  const raw = await readFile(absolute);
  if (raw.includes(0)) {
    return { ok: false, code: 'UNAVAILABLE', text: 'That path is not available.' };
  }
  const lines = raw.toString('utf8').replace(/\r\n/g, '\n').split('\n');
  const start = Math.max(1, startLine);
  const end = Math.min(lines.length, endLine ?? start + 199, start + 199);
  const body = lines
    .slice(start - 1, end)
    .map((line, index) => `${start + index}|${line}`)
    .join('\n')
    .slice(0, 20_000);
  return { ok: true, text: body };
}

async function search(root: string, query: string, tool: string): Promise<string[]> {
  const needle = query.toLowerCase();
  const files = await walk(root, '', MAX_DEPTH);
  const hits: string[] = [];
  let scanned = 0;
  for (const relative of files) {
    if (hits.length >= MAX_HITS || scanned >= MAX_FILES) {
      break;
    }
    if (relative.endsWith('/')) {
      continue;
    }
    const absolute = path.resolve(root, relative);
    let info;
    try {
      info = await lstat(absolute);
    } catch {
      continue;
    }
    if (!info.isFile() || info.isSymbolicLink() || info.size > 200_000) {
      continue;
    }
    scanned += 1;
    const raw = await readFile(absolute);
    if (raw.includes(0)) {
      continue;
    }
    const lines = raw.toString('utf8').replace(/\r\n/g, '\n').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      if (!lineMatches(tool, line, needle, query)) {
        continue;
      }
      hits.push(`${relative}:${index + 1}:${line.slice(0, 160)}`);
      if (hits.length >= MAX_HITS) {
        break;
      }
    }
  }
  return hits;
}

function lineMatches(tool: string, line: string, needle: string, query: string): boolean {
  if (tool === 'search_code' || tool === 'search_symbol') {
    return line.toLowerCase().includes(needle);
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const kind = tool === 'find_class' ? 'class|struct|interface|enum|type' : 'function|func|fn|def';
  return new RegExp(`\\b(?:${kind})\\s+${escaped}\\b`, 'u').test(line) || line.includes(query);
}

async function walk(root: string, relative: string, depth: number): Promise<string[]> {
  const start = relative ? path.resolve(root, relative) : root;
  if (!inside(root, start)) {
    return [];
  }
  const found: string[] = [];
  await visit(root, start, depth, found);
  return found;
}

async function visit(root: string, current: string, depth: number, found: string[]): Promise<void> {
  if (found.length >= MAX_FILES || depth < 0) {
    return;
  }
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (found.length >= MAX_FILES) {
      return;
    }
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (
      entry.isSymbolicLink() ||
      isIgnoredRepositoryPath(relative) ||
      isSecretRepositoryPath(relative)
    ) {
      continue;
    }
    if (entry.isDirectory()) {
      found.push(`${relative}/`);
      await visit(root, absolute, depth - 1, found);
      continue;
    }
    if (entry.isFile()) {
      found.push(relative);
    }
  }
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
