import path from 'node:path';

export class PathTraversalError extends Error {
  override readonly name = 'PathTraversalError';

  constructor(message = 'Path escapes the repository root.') {
    super(message);
  }
}

export function resolveWithinRoot(root: string, requestedPath: string): string {
  if (requestedPath.includes('\0')) {
    throw new PathTraversalError('Invalid path.');
  }

  if (path.isAbsolute(requestedPath)) {
    throw new PathTraversalError();
  }

  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, requestedPath);
  const relative = path.relative(normalizedRoot, resolved);

  if (relative === '') {
    return resolved;
  }

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PathTraversalError();
  }

  return resolved;
}
