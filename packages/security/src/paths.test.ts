import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PathTraversalError, resolveWithinRoot } from './paths';

const root = path.join(os.tmpdir(), 'codepilot-root');

describe('resolveWithinRoot', () => {
  it('resolves a relative path inside the root', () => {
    const resolved = resolveWithinRoot(root, path.join('src', 'app.ts'));
    const relative = path.relative(root, resolved);

    expect(relative.startsWith('..')).toBe(false);
    expect(path.isAbsolute(relative)).toBe(false);
  });

  it('rejects paths that escape the root', () => {
    expect(() => resolveWithinRoot(root, path.join('..', 'outside'))).toThrow(PathTraversalError);
    expect(() => resolveWithinRoot(root, path.join('src', '..', '..', 'outside'))).toThrow(
      PathTraversalError,
    );
  });

  it('rejects absolute paths and null bytes', () => {
    expect(() => resolveWithinRoot(root, path.resolve(root, '..', 'outside.txt'))).toThrow(
      PathTraversalError,
    );
    expect(() => resolveWithinRoot(root, 'src/\0app.ts')).toThrow(/Invalid path/);
  });
});
