import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { barRaiserReport, compactBarRaiser } from './suite';

describe('document evaluation suite', () => {
  it('beats the first-number baseline on all twelve cases', () => {
    const report = barRaiserReport();
    expect(report.cases).toBeGreaterThanOrEqual(10);
    expect(report.improvedPassed).toBe(report.cases);
    expect(report.improvedPassed).toBeGreaterThan(report.baselinePassed);
    const committed = JSON.parse(
      readFileSync(path.join(process.cwd(), 'docs/evaluation/bar-raiser.json'), 'utf8'),
    ) as ReturnType<typeof compactBarRaiser>;
    expect(compactBarRaiser(report)).toEqual(committed);
  });
});
