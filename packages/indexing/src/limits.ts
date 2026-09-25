export const INDEX_LIMITS = {
  maxFiles: 2_000,
  maxFileBytes: 200_000,
  maxChunks: 4_000,
  maxChunkChars: 4_000,
  maxPathLength: 300,
  windowLines: 80,
  windowOverlap: 15,
  maxDepth: 20,
} as const;
