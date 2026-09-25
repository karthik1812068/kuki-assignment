import { LOCAL_EMBEDDING_DIMENSIONS } from '@codepilot/types';
import { describe, expect, it } from 'vitest';
import { cosineSimilarity, embedLocal } from './embed';

describe('embedLocal', () => {
  it('returns a stable unit vector without calling a model', () => {
    const first = embedLocal('login user session');
    const second = embedLocal('login user session');
    expect(first).toEqual(second);
    expect(first).toHaveLength(LOCAL_EMBEDDING_DIMENSIONS);
    const norm = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it('ranks shared tokens above unrelated text', () => {
    const query = embedLocal('login user');
    const related = cosineSimilarity(query, embedLocal('login user session'));
    const unrelated = cosineSimilarity(query, embedLocal('banana recipe'));
    expect(related).toBeGreaterThan(unrelated);
  });
});
