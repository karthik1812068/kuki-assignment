import { describe, expect, it } from 'vitest';
import { planSearchQuery } from './plan-search';

describe('planSearchQuery', () => {
  it('searches the identifier instead of the whole sentence', () => {
    expect(planSearchQuery('Find greet', 'Locate the greet function.')).toBe('greet');
  });

  it('keeps a short title when every word is generic', () => {
    expect(planSearchQuery('Fix', '')).toBe('Fix');
  });

  it('searches a named file before a longer word', () => {
    expect(planSearchQuery('add a note', 'Add one sentence to README.md.')).toBe('README.md');
  });

  it('searches FY2024 when the task names a financial year', () => {
    expect(planSearchQuery('Compare years', 'Use financial year 2024 not calendar 2023')).toBe(
      'FY2024',
    );
  });
});
