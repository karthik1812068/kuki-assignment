const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'tmp',
  'temp',
  '.turbo',
  '.cache',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.tgz',
  '.7z',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.mp3',
  '.wav',
  '.wasm',
  '.class',
  '.jar',
  '.pyc',
]);

const PRIVATE_KEY_BASENAMES = new Set([
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'id_rsa.pub',
  'id_dsa.pub',
  'id_ecdsa.pub',
  'id_ed25519.pub',
]);

const SECRET_EXTENSIONS = new Set(['.pem', '.p12', '.pfx', '.key']);

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.md',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.rb',
]);

function toPosix(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

function basename(filePath: string): string {
  const normalized = toPosix(filePath);
  const slash = normalized.lastIndexOf('/');
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

function extensionOf(fileName: string): string {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot <= 0) {
    return '';
  }
  return lower.slice(dot);
}

function hasSensitiveWord(fileName: string, word: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${word}s?([^a-z0-9]|$)`, 'i');
  return pattern.test(fileName);
}

export function isSecretRepositoryPath(filePath: string): boolean {
  const base = basename(filePath);
  const lower = base.toLowerCase();

  if (lower === '.env' || lower.startsWith('.env.')) {
    return true;
  }

  if (PRIVATE_KEY_BASENAMES.has(lower)) {
    return true;
  }

  const extension = extensionOf(lower);
  if (SECRET_EXTENSIONS.has(extension)) {
    return true;
  }

  if (lower.includes('credential') || lower.includes('password')) {
    return true;
  }

  if (hasSensitiveWord(lower, 'secret')) {
    return true;
  }

  if (hasSensitiveWord(lower, 'token') && !SOURCE_EXTENSIONS.has(extension)) {
    return true;
  }

  return false;
}

export function isIgnoredRepositoryPath(filePath: string): boolean {
  const normalized = toPosix(filePath);
  const segments = normalized.split('/').filter((segment) => segment.length > 0);

  if (segments.some((segment) => IGNORED_DIRECTORIES.has(segment))) {
    return true;
  }

  const base = segments[segments.length - 1] ?? '';
  if (
    base.endsWith('~') ||
    base.endsWith('.tmp') ||
    base.endsWith('.swp') ||
    base.startsWith('.#')
  ) {
    return true;
  }

  if (BINARY_EXTENSIONS.has(extensionOf(base))) {
    return true;
  }

  return isSecretRepositoryPath(normalized);
}
