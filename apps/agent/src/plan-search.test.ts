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
});
