import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { embedLocal } from '@codepilot/ai';
import { LOCAL_EMBEDDING_MODEL } from '@codepilot/types';
import { isIgnoredRepositoryPath, resolveWithinRoot } from '@codepilot/security';
import { chunkSource } from './chunk';
import { detectProject, isIndexableFile, languageFromPath, type IndexDetection } from './detect';
import { INDEX_LIMITS } from './limits';
import { isSafeRelativePath } from './safe-path';

const LOCKFILES = new Set([
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
  'go.sum',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

export class IndexError extends Error {
  override readonly name = 'IndexError';

  constructor(readonly reason: 'missing_root') {
    super(reason);
  }
}

export interface IndexedFile {
  path: string;
  language: string | null;
  byteSize: number;
  lineCount: number;
  contentSha256: string;
}

export interface IndexedChunk {
  path: string;
  symbol: string | null;
  language: string | null;
  startLine: number;
  endLine: number;
  content: string;
  embedding: number[];
}

export interface IndexBuild {
  files: IndexedFile[];
  chunks: IndexedChunk[];
  detection: IndexDetection;
  truncated: boolean;
  embeddingModel: typeof LOCAL_EMBEDDING_MODEL;
}

interface ReadSource {
  path: string;
  language: string | null;
  byteSize: number;
  text: string;
}

export async function buildRepositoryIndex(root: string): Promise<IndexBuild> {
  let info: Awaited<ReturnType<typeof lstat>>;
  try {
    info = await lstat(root);
  } catch {
    throw new IndexError('missing_root');
  }
  if (!info.isDirectory()) {
    throw new IndexError('missing_root');
  }

  const sources: ReadSource[] = [];
  const markers: string[] = [];
  let truncated = false;
  await walk(root, root, 0, sources, markers, () => {
    truncated = true;
  });

  const detection = detectProject(
    sources.map((source) => ({ path: source.path, text: source.text })),
    markers,
  );
  let chunks = sources.flatMap((source) =>
    chunkSource({ path: source.path, language: source.language, text: source.text }),
  );
  if (chunks.length > INDEX_LIMITS.maxChunks) {
    chunks = chunks.slice(0, INDEX_LIMITS.maxChunks);
    truncated = true;
  }

  return {
    files: sources.map((source) => ({
      path: source.path,
      language: source.language,
      byteSize: source.byteSize,
      lineCount: source.text.split('\n').length,
      contentSha256: createHash('sha256').update(source.text).digest('hex'),
    })),
    chunks: chunks.map((chunk) => ({
      ...chunk,
      embedding: embedLocal(`${chunk.path}\n${chunk.symbol ?? ''}\n${chunk.content}`),
    })),
    detection,
    truncated,
    embeddingModel: LOCAL_EMBEDDING_MODEL,
  };
}

async function walk(
  root: string,
  directory: string,
  depth: number,
  sources: ReadSource[],
  markers: string[],
  markTruncated: () => void,
): Promise<void> {
  if (depth > INDEX_LIMITS.maxDepth) {
    markTruncated();
    return;
  }
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    const relative = toPosix(path.relative(root, path.join(directory, entry.name)));
    if (!isSafeRelativePath(relative) || isIgnoredRepositoryPath(relative)) {
      continue;
    }
    const absolute = resolveWithinRoot(root, relative);
    if (entry.isDirectory()) {
      await walk(root, absolute, depth + 1, sources, markers, markTruncated);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const name = entry.name;
    if (LOCKFILES.has(name)) {
      markers.push(relative);
      continue;
    }
    if (!isIndexableFile(relative)) {
      continue;
    }
    if (sources.length >= INDEX_LIMITS.maxFiles) {
      markTruncated();
      continue;
    }
    const fileInfo = await lstat(absolute);
    if (fileInfo.isSymbolicLink() || !fileInfo.isFile()) {
      continue;
    }
    if (fileInfo.size === 0 || fileInfo.size > INDEX_LIMITS.maxFileBytes) {
      continue;
    }
    const buffer = await readFile(absolute);
    if (buffer.includes(0)) {
      continue;
    }
    const text = buffer.toString('utf8');
    if (text.trim().length === 0) {
      continue;
    }
    sources.push({
      path: relative,
      language: languageFromPath(relative),
      byteSize: buffer.byteLength,
      text,
    });
  }
}

function toPosix(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}
