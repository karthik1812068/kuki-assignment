import { tokenize } from '@codepilot/ai';
import type { CodeSearchHit } from '@codepilot/types';
import { isSafeRelativePath } from './safe-path';

export interface RankCandidate {
  path: string;
  symbol: string | null;
  language: string | null;
  startLine: number;
  endLine: number;
  content: string;
  cosine: number;
}

const RESULT_LIMIT = 8;
const EXCERPT_CHARS = 400;

export function rankChunks(query: string, candidates: readonly RankCandidate[]): CodeSearchHit[] {
  const tokens = tokenize(query);
  const scored = candidates
    .filter((candidate) => isRankable(candidate))
    .map((candidate) => {
      const semanticScore = unit(candidate.cosine);
      const keywordScore = keyword(tokens, candidate.content);
      const symbolScore = symbolMatch(query, candidate.symbol);
      return {
        candidate,
        semanticScore,
        keywordScore,
        symbolScore,
        rank: 0.5 * semanticScore + 0.35 * keywordScore + 0.15 * symbolScore,
      };
    });

  scored.sort((left, right) => {
    if (right.rank !== left.rank) {
      return right.rank - left.rank;
    }
    if (left.candidate.path !== right.candidate.path) {
      return left.candidate.path < right.candidate.path ? -1 : 1;
    }
    return left.candidate.startLine - right.candidate.startLine;
  });

  return scored.slice(0, RESULT_LIMIT).map((item) => ({
    path: item.candidate.path,
    symbol: cleanSymbol(item.candidate.symbol),
    language: item.candidate.language,
    startLine: item.candidate.startLine,
    endLine: item.candidate.endLine,
    excerpt: excerpt(item.candidate.content),
    semanticScore: round4(item.semanticScore),
    keywordScore: round4(item.keywordScore),
    symbolScore: round4(item.symbolScore),
  }));
}

function isRankable(candidate: RankCandidate): boolean {
  return (
    isSafeRelativePath(candidate.path) &&
    Number.isInteger(candidate.startLine) &&
    Number.isInteger(candidate.endLine) &&
    candidate.startLine >= 1 &&
    candidate.endLine >= candidate.startLine
  );
}

function keyword(tokens: readonly string[], content: string): number {
  if (tokens.length === 0) {
    return 0;
  }
  const haystack = content.toLowerCase();
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits / tokens.length;
}

function symbolMatch(query: string, symbol: string | null): number {
  if (!symbol) {
    return 0;
  }
  const left = query.trim().toLowerCase();
  const right = symbol.toLowerCase();
  if (left.length === 0) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  if (right.includes(left) || left.includes(right)) {
    return 0.7;
  }
  return 0;
}

function cleanSymbol(symbol: string | null): string | null {
  if (!symbol) {
    return null;
  }
  let result = '';
  for (const char of symbol) {
    if (char.charCodeAt(0) > 31) {
      result += char;
    }
  }
  const trimmed = result.trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    return null;
  }
  return trimmed;
}

function excerpt(content: string): string {
  let result = '';
  for (const char of content) {
    if (char.charCodeAt(0) === 0) {
      continue;
    }
    result += char;
    if (result.length >= EXCERPT_CHARS) {
      break;
    }
  }
  return result;
}

function unit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
