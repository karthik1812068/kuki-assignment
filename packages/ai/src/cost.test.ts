import { describe, expect, it } from 'vitest';
import { estimateModelCost } from './cost';

describe('estimateModelCost', () => {
  it('returns null until both prices are configured', () => {
    expect(estimateModelCost(1000, 500, undefined, 2)).toBeNull();
    expect(estimateModelCost(1_000_000, 0, 3, 0)).toBe(3);
    expect(estimateModelCost(500_000, 250_000, 2, 4)).toBe(2);
  });
});
