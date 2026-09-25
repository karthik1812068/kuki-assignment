import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cosineSimilarity, embedLocal } from '@codepilot/ai';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRepositoryIndex } from './build';
import { chunkSource } from './chunk';
import { rankChunks } from './rank';

describe('repository index', () => {
  const directories: string[] = [];

  afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await Promise.all(
      directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it('chunks symbols, skips secrets and dependencies, and ranks the symbol', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codepilot-index-'));
    directories.push(root);
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'node_modules', 'left-pad'), { recursive: true });
    await writeFile(
      path.join(root, 'src', 'auth.ts'),
      'export function loginUser() {\n  return "session";\n}\n',
    );
    await writeFile(path.join(root, '.env'), 'SECRET_TOKEN=super-secret-value\n');
    await writeFile(
      path.join(root, 'node_modules', 'left-pad', 'index.js'),
      'module.exports = "nope";\n',
    );
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        dependencies: { react: '19.0.0' },
        devDependencies: { vitest: '5.0.0' },
        scripts: { start: 'node secret-script' },
      }),
    );

    const build = await buildRepositoryIndex(root);
    const combined = JSON.stringify(build.chunks);
    expect(combined).not.toContain('super-secret-value');
    expect(combined).not.toContain('left-pad');
    expect(build.files.some((file) => file.path === 'src/auth.ts')).toBe(true);
    expect(build.detection.frameworks).toContain('React');
    expect(build.detection.testFrameworks).toContain('Vitest');
    expect(build.detection.packageManagers).toContain('npm');
    expect(build.embeddingModel).toBe('local-hash-v1');

    const query = 'loginUser';
    const hits = rankChunks(
      query,
      build.chunks.map((chunk) => ({
        ...chunk,
        cosine: cosineSimilarity(embedLocal(query), chunk.embedding),
      })),
    );
    expect(hits[0]?.symbol).toBe('loginUser');
    expect(hits[0]?.path).toBe('src/auth.ts');
    expect(JSON.stringify(hits)).not.toContain('super-secret-value');
  });

  it('splits a long file without symbols into overlapping windows', () => {
    const lines = Array.from({ length: 100 }, (_, index) => `line ${index + 1}`);
    const chunks = chunkSource({ path: 'notes.txt', language: null, text: lines.join('\n') });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks[1]?.startLine).toBe(66);
  });
});
