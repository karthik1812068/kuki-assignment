import { INDEX_LIMITS } from './limits';

export function isSafeRelativePath(filePath: string): boolean {
  if (filePath.length === 0 || filePath.length > INDEX_LIMITS.maxPathLength) {
    return false;
  }
  if (filePath.startsWith('/') || filePath.includes('\\') || filePath.includes('\0')) {
    return false;
  }
  const segments = filePath.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}
