import { rankChunks, type RankCandidate } from '@codepilot/indexing';
import { baselinePlanSearchQuery, planSearchQuery } from './plan-search';

export interface EvaluationCase {
  id: string;
  area: 'search' | 'period';
  title: string;
  description: string;
  expectedQuery?: string;
  expectedPath?: string;
}

export interface EvaluationReport {
  command: string;
  cases: number;
  baselinePassed: number;
  improvedPassed: number;
  baselineScore: number;
  improvedScore: number;
  details: Array<{ id: string; area: string; baseline: boolean; improved: boolean }>;
}

const CASES: EvaluationCase[] = [
  {
    id: 'identifier-search',
    area: 'search',
    title: 'Find greet',
    description: 'Locate the greet function.',
    expectedQuery: 'greet',
  },
  {
    id: 'named-file',
    area: 'search',
    title: 'add a note',
    description: 'Add one sentence to README.md.',
    expectedQuery: 'README.md',
  },
  {
    id: 'generic-title',
    area: 'search',
    title: 'Fix',
    description: '',
    expectedQuery: 'Fix',
  },
  {
    id: 'fy-range-file',
    area: 'search',
    title: 'Revenue note',
    description: 'Update FY 2023-24 in notes.md',
    expectedQuery: 'notes.md',
  },
  {
    id: 'fy-not-calendar',
    area: 'search',
    title: 'Compare years',
    description: 'Use financial year 2024 not calendar 2023',
    expectedQuery: 'FY2024',
  },
  {
    id: 'rank-fy-over-calendar',
    area: 'period',
    title: 'Accounts',
    description: 'financial year 2024',
    expectedPath: 'report.md',
  },
];

const RANK_CANDIDATES: RankCandidate[] = [
  {
    path: 'old.md',
    symbol: null,
    language: null,
    startLine: 1,
    endLine: 2,
    content: 'These financial year tables still use calendar year 2023.',
    cosine: 0.1,
  },
  {
    path: 'report.md',
    symbol: null,
    language: null,
    startLine: 1,
    endLine: 2,
    content: 'FY2024 closed in March after the 2023-24 period.',
    cosine: 0.1,
  },
];

export function evaluationReport(): EvaluationReport {
  const details = CASES.map((item) => ({
    id: item.id,
    area: item.area,
    baseline: runCase(item, 'baseline'),
    improved: runCase(item, 'improved'),
  }));
  const baselinePassed = details.filter((item) => item.baseline).length;
  const improvedPassed = details.filter((item) => item.improved).length;
  return {
    command: 'npm test',
    cases: CASES.length,
    baselinePassed,
    improvedPassed,
    baselineScore: round3(baselinePassed / CASES.length),
    improvedScore: round3(improvedPassed / CASES.length),
    details,
  };
}

function runCase(item: EvaluationCase, mode: 'baseline' | 'improved'): boolean {
  if (item.area === 'search' && item.expectedQuery) {
    const query =
      mode === 'baseline'
        ? baselinePlanSearchQuery(item.title, item.description)
        : planSearchQuery(item.title, item.description);
    return query === item.expectedQuery;
  }
  if (item.area === 'period' && item.expectedPath) {
    const query = `${item.title} ${item.description}`;
    if (mode === 'baseline') {
      return keywordRankPath(query, RANK_CANDIDATES) === item.expectedPath;
    }
    const hits = rankChunks(query, RANK_CANDIDATES);
    return hits[0]?.path === item.expectedPath;
  }
  return false;
}

function keywordRankPath(query: string, candidates: readonly RankCandidate[]): string | undefined {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 2);
  const scored = candidates.map((candidate) => {
    const haystack = candidate.content.toLowerCase();
    return {
      path: candidate.path,
      score: tokens.filter((token) => haystack.includes(token)).length,
    };
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.path;
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
