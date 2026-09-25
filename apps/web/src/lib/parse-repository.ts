import {
  DETECTED_FRAMEWORKS,
  DETECTED_LANGUAGES,
  DETECTED_PACKAGE_MANAGERS,
  DETECTED_TEST_FRAMEWORKS,
  INDEXING_STATUSES,
  LOCAL_EMBEDDING_MODEL,
  REPOSITORY_PERMISSIONS,
  REPOSITORY_STATUSES,
  type AvailableRepository,
  type CodeSearchHit,
  type CodeSearchResponse,
  type ImportedRepository,
  type IndexingStatus,
  type RepositoryPermission,
  type RepositoryStatus,
} from '@codepilot/types';

const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function parseAvailableRepository(value: unknown): AvailableRepository | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.githubRepoId !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.fullName !== 'string'
  ) {
    return null;
  }
  if (
    !FULL_NAME.test(record.fullName) ||
    typeof record.defaultBranch !== 'string' ||
    typeof record.private !== 'boolean'
  ) {
    return null;
  }
  if (typeof record.htmlUrl !== 'string' || !record.htmlUrl.startsWith('https://github.com/')) {
    return null;
  }
  const permission = knownPermission(record.permission);
  if (!permission) {
    return null;
  }
  return {
    githubRepoId: record.githubRepoId,
    name: record.name,
    fullName: record.fullName,
    defaultBranch: record.defaultBranch,
    language: typeof record.language === 'string' ? record.language : null,
    description: typeof record.description === 'string' ? record.description : null,
    private: record.private,
    htmlUrl: record.htmlUrl,
    permission,
  };
}

export function parseImportedRepository(value: unknown): ImportedRepository | null {
  const available = parseAvailableRepository(value);
  if (!available || !value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    !REPOSITORY_STATUSES.includes(record.status as RepositoryStatus)
  ) {
    return null;
  }
  const indexing = knownIndexing(record.indexing);
  const fileCount = optionalCount(record.fileCount);
  const chunkCount = optionalCount(record.chunkCount);
  if (!indexing || fileCount === undefined || chunkCount === undefined) {
    return null;
  }
  if (record.indexedAt !== null && typeof record.indexedAt !== 'string') {
    return null;
  }
  return {
    ...available,
    id: record.id,
    status: record.status as RepositoryStatus,
    cloneError: typeof record.cloneError === 'string' ? record.cloneError : null,
    indexing,
    indexingError: typeof record.indexingError === 'string' ? record.indexingError : null,
    indexTruncated: record.indexTruncated === true,
    indexedAt: typeof record.indexedAt === 'string' ? record.indexedAt : null,
    fileCount,
    chunkCount,
    detectedLanguages: labelList(record.detectedLanguages, DETECTED_LANGUAGES),
    detectedFrameworks: labelList(record.detectedFrameworks, DETECTED_FRAMEWORKS),
    detectedPackageManagers: labelList(record.detectedPackageManagers, DETECTED_PACKAGE_MANAGERS),
    detectedTestFrameworks: labelList(record.detectedTestFrameworks, DETECTED_TEST_FRAMEWORKS),
    embeddingModel: record.embeddingModel === LOCAL_EMBEDDING_MODEL ? record.embeddingModel : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
  };
}

export function parseCodeSearch(value: unknown): CodeSearchResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const indexing = knownIndexing(record.indexing);
  if (!indexing || !Array.isArray(record.hits)) {
    return null;
  }
  const hits: CodeSearchHit[] = [];
  for (const item of record.hits) {
    const hit = parseHit(item);
    if (!hit) {
      return null;
    }
    hits.push(hit);
  }
  return { indexing, hits };
}

export function parseRepositoryList<T>(
  value: unknown,
  parse: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: T[] = [];
  for (const item of value) {
    const parsed = parse(item);
    if (!parsed) {
      return null;
    }
    items.push(parsed);
  }
  return items;
}

function knownIndexing(value: unknown): IndexingStatus | null {
  return INDEXING_STATUSES.find((status) => status === value) ?? null;
}

function optionalCount(value: unknown): number | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10_000) {
    return undefined;
  }
  return value;
}

function labelList(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allow = new Set<string>(allowed);
  return value.filter((item): item is string => typeof item === 'string' && allow.has(item));
}

function parseHit(value: unknown): CodeSearchHit | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.path !== 'string' ||
    record.path.startsWith('/') ||
    record.path.includes('..') ||
    record.path.includes('\\') ||
    typeof record.excerpt !== 'string' ||
    !Number.isInteger(record.startLine) ||
    !Number.isInteger(record.endLine)
  ) {
    return null;
  }
  return {
    path: record.path,
    symbol: typeof record.symbol === 'string' ? record.symbol : null,
    language: typeof record.language === 'string' ? record.language : null,
    startLine: record.startLine as number,
    endLine: record.endLine as number,
    excerpt: record.excerpt.slice(0, 400),
    semanticScore: unitScore(record.semanticScore),
    keywordScore: unitScore(record.keywordScore),
    symbolScore: unitScore(record.symbolScore),
  };
}

function unitScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function knownPermission(value: unknown): RepositoryPermission | null {
  return REPOSITORY_PERMISSIONS.find((permission) => permission === value) ?? null;
}
