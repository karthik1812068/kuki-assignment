import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluationReport } from './evaluation';
import { baselinePlanSearchQuery, planSearchQuery } from './plan-search';

describe('evaluation harness', () => {
  it('improves on the baseline for files and financial years', () => {
    expect(baselinePlanSearchQuery('add a note', 'Add one sentence to README.md.')).toBe(
      'sentence',
    );
    expect(planSearchQuery('add a note', 'Add one sentence to README.md.')).toBe('README.md');
    expect(planSearchQuery('Compare years', 'Use financial year 2024 not calendar 2023')).toBe(
      'FY2024',
    );
    const report = evaluationReport();
    expect(report.improvedPassed).toBe(report.cases);
    expect(report.improvedPassed).toBeGreaterThan(report.baselinePassed);
    const committed = JSON.parse(
      readFileSync(path.join(process.cwd(), 'docs/evaluation/results.json'), 'utf8'),
    ) as { improvedScore: number; baselineScore: number; cases: number };
    expect(report.cases).toBe(committed.cases);
    expect(report.baselineScore).toBe(committed.baselineScore);
    expect(report.improvedScore).toBe(committed.improvedScore);
  });
});
