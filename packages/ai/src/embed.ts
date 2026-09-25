import { LOCAL_EMBEDDING_DIMENSIONS } from '@codepilot/types';

const TOKEN_LIMIT = 2_000;

export function tokenize(value: string): string[] {
  const split = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((token) => token.length >= 2);
  return split.slice(0, TOKEN_LIMIT);
}

/**
 * Feature-hash embedding. It stays in this process and does not call a model.
 * Shared tokens land in the same dimensions, so cosine similarity follows token overlap.
 */
export function embedLocal(value: string): number[] {
  const vector = Array.from({ length: LOCAL_EMBEDDING_DIMENSIONS }, () => 0);
  for (const token of tokenize(value)) {
    const hash = fnv1a(token);
    const index = hash % LOCAL_EMBEDDING_DIMENSIONS;
    const sign = (hash & 1) === 0 ? 1 : -1;
    const current = vector[index] ?? 0;
    vector[index] = current + sign;
  }
  return normalize(vector);
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  const value = dot / Math.sqrt(leftNorm * rightNorm);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(-1, value));
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalize(vector: number[]): number[] {
  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  if (norm === 0) {
    return vector;
  }
  const scale = 1 / Math.sqrt(norm);
  return vector.map((value) => value * scale);
}
