import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PathTraversalError, resolveWithinRoot } from '@codepilot/security';
import { unifiedDiff } from './diff';
import { isWorkspacePath, type ProposedEdit } from './proposal';

export class EditError extends Error {
  override readonly name = 'EditError';

  constructor(readonly reason: 'unavailable' | 'exists' | 'missing' | 'mismatch') {
    super(
      reason === 'exists'
        ? 'The file already exists.'
        : reason === 'missing'
          ? 'The file was not found.'
          : reason === 'mismatch'
            ? 'The text to replace was not found once.'
            : 'That path is not available.',
    );
  }
}

export interface AppliedEdit {
  path: string;
  type: ProposedEdit['type'];
  before: string;
  after: string;
  diff: string;
  reason: string;
}

export async function applyEdit(root: string, edit: ProposedEdit): Promise<AppliedEdit> {
  if (!isWorkspacePath(edit.path)) {
    throw new EditError('unavailable');
  }
  let absolute: string;
  try {
    absolute = resolveWithinRoot(root, edit.path);
  } catch (error) {
    if (error instanceof PathTraversalError) {
      throw new EditError('unavailable');
    }
    throw error;
  }
  if (path.relative(root, absolute).startsWith('..')) {
    throw new EditError('unavailable');
  }
  const before = await readOptional(absolute);
  if (edit.type === 'delete') {
    if (before === null) {
      throw new EditError('missing');
    }
    await rm(absolute);
    return done(edit, before, '');
  }
  if (edit.type === 'create') {
    if (before !== null) {
      throw new EditError('exists');
    }
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, edit.content ?? '', 'utf8');
    return done(edit, '', edit.content ?? '');
  }
  if (edit.type === 'write') {
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, edit.content ?? '', 'utf8');
    return done(edit, before ?? '', edit.content ?? '');
  }
  if (before === null) {
    throw new EditError('missing');
  }
  const normalized = before.replace(/\r\n/g, '\n');
  const crlf = before.includes('\r\n');
  const oldText = (edit.oldText ?? '').replace(/\r\n/g, '\n');
  const addition = (edit.newText ?? '').replace(/\r\n/g, '\n');
  if (oldText.length === 0) {
    if (!addition.trim()) {
      throw new EditError('mismatch');
    }
    const gap = normalized.length === 0 || normalized.endsWith('\n') ? '' : '\n';
    const tail = addition.endsWith('\n') ? addition : `${addition}\n`;
    const after = restoreNewlines(`${normalized}${gap}${tail}`, crlf);
    await writeFile(absolute, after, 'utf8');
    return done(edit, before, after);
  }
  const first = normalized.indexOf(oldText);
  if (first < 0 || normalized.indexOf(oldText, first + oldText.length) >= 0) {
    throw new EditError('mismatch');
  }
  const after = restoreNewlines(
    `${normalized.slice(0, first)}${addition}${normalized.slice(first + oldText.length)}`,
    crlf,
  );
  await writeFile(absolute, after, 'utf8');
  return done(edit, before, after);
}

function restoreNewlines(value: string, crlf: boolean): string {
  return crlf ? value.replace(/\n/g, '\r\n') : value;
}

function done(edit: ProposedEdit, before: string, after: string): AppliedEdit {
  return {
    path: edit.path,
    type: edit.type,
    before,
    after,
    diff: unifiedDiff(edit.path, before, after),
    reason: edit.reason,
  };
}

async function readOptional(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  }
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
