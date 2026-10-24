import { describe, expect, it } from 'vitest';
import { classifyKind, extractDocument } from './extract-document';

describe('extractDocument', () => {
  it('keeps CSV values connected to sheet coordinates', () => {
    const csv = Buffer.from('month,kwh,amount\nApr,120,900\nFY 2023-24,140,1100\n', 'utf8');
    const extracted = extractDocument('electricity-bill.csv', csv);
    expect(extracted.kind).toBe('bill');
    expect(extracted.financialYears).toContain('FY2024');
    expect(extracted.facts.some((fact) => fact.source.locator.includes('row 3'))).toBe(true);
    expect(extracted.facts.every((fact) => fact.calculated === false)).toBe(true);
  });

  it('classifies policy and spreadsheet names', () => {
    expect(classifyKind('quality-policy.pdf')).toBe('policy');
    expect(classifyKind('monthly-workbook.xlsx')).toBe('spreadsheet');
  });
});
