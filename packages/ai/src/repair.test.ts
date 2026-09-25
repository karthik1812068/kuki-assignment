import { describe, expect, it } from 'vitest';
import { repairDecision } from './repair';

const base = {
  failed: true,
  repairCount: 0,
  repairLimit: 3,
  failureHash: 'a',
  previousHash: null,
  modelConfigured: true,
  securityViolation: false,
  cancelled: false,
};

describe('repairDecision', () => {
  it('stops at the configured limit, a repeat, or a passing run', () => {
    expect(repairDecision(base)).toBe('continue');
    expect(repairDecision({ ...base, repairCount: 3 })).toBe('stop');
    expect(repairDecision({ ...base, previousHash: 'a' })).toBe('stop');
    expect(repairDecision({ ...base, failed: false })).toBe('pass');
    expect(repairDecision({ ...base, modelConfigured: false })).toBe('stop');
    expect(repairDecision({ ...base, securityViolation: true })).toBe('stop');
  });
});
