import { describe, expect, it } from 'vitest';
import { AGENT_STATES } from './index';

describe('AGENT_STATES', () => {
  it('lists each agent state from the product requirements once', () => {
    expect(AGENT_STATES).toEqual([
      'CREATED',
      'ANALYZING',
      'PLANNING',
      'WAITING_FOR_APPROVAL',
      'EXECUTING',
      'TESTING',
      'ANALYZING_FAILURE',
      'FIXING',
      'VALIDATING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ]);
    expect(new Set(AGENT_STATES).size).toBe(AGENT_STATES.length);
  });
});
