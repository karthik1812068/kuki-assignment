import { describe, expect, it } from 'vitest';
import { parseFinancialPeriod, periodMatchScore } from './periods';
import { rankChunks } from './rank';

describe('financial periods', () => {
  it('treats FY 2023-24 as the year ending 2024', () => {
    expect(parseFinancialPeriod('Update FY 2023-24 revenue')).toEqual({
      kind: 'fiscal',
      startYear: 2023,
      endYear: 2024,
      label: 'FY2024',
      query: 'FY2024',
    });
  });

  it('maps FY2024 to the year ending 2024', () => {
    expect(parseFinancialPeriod('financial year 2024')).toMatchObject({
      kind: 'fiscal',
      startYear: 2023,
      endYear: 2024,
      label: 'FY2024',
    });
  });

  it('keeps calendar year 2024 distinct from FY 2023-24', () => {
    expect(parseFinancialPeriod('calendar year 2024')).toEqual({
      kind: 'calendar',
      startYear: 2024,
      endYear: 2024,
      label: 'CY2024',
      query: 'CY2024',
    });
  });

  it('does not treat Node 22 as a financial year', () => {
    expect(parseFinancialPeriod('Upgrade Node 22 and TypeScript 5.9.3')).toBeNull();
  });

  it('ranks the FY2024 excerpt above a calendar-2023 excerpt', () => {
    const hits = rankChunks('revenue in FY 2023-24', [
      chunk('notes.md', 'calendar year 2023 sales were lower.', 0.1),
      chunk('report.md', 'FY2024 revenue grew after the 2023-24 close.', 0.1),
    ]);
    expect(hits[0]?.path).toBe('report.md');
    expect(periodMatchScore('FY 2023-24', 'FY2024 revenue')).toBeGreaterThan(
      periodMatchScore('FY 2023-24', 'calendar year 2023 sales'),
    );
  });
});

function chunk(path: string, content: string, cosine: number) {
  return {
    path,
    symbol: null,
    language: null,
    startLine: 1,
    endLine: 2,
    content,
    cosine,
  };
}
