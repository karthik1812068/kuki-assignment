import { describe, expect, it } from 'vitest';
import { AgentStateMachine, AgentTransitionError } from './agent-state';

describe('AgentStateMachine', () => {
  it('logs every legal transition and rejects a terminal hop', () => {
    let tick = 0;
    const machine = new AgentStateMachine(() => new Date(Date.UTC(2026, 8, 24, 0, 0, tick++)));
    const path = [
      'ANALYZING',
      'PLANNING',
      'WAITING_FOR_APPROVAL',
      'EXECUTING',
      'TESTING',
      'VALIDATING',
      'COMPLETED',
    ] as const;
    for (const state of path) {
      machine.transition(state, `enter ${state}`);
    }
    expect(machine.state).toBe('COMPLETED');
    expect(machine.transitions.map((entry) => entry.to)).toEqual(['CREATED', ...path]);
    expect(machine.transitions.every((entry) => entry.reason.length > 0)).toBe(true);
    expect(() => machine.transition('ANALYZING', 'again')).toThrow(AgentTransitionError);
  });

  it('allows the repair loop back to testing', () => {
    const machine = new AgentStateMachine(() => new Date('2026-09-24T00:00:00.000Z'));
    for (const state of [
      'ANALYZING',
      'PLANNING',
      'WAITING_FOR_APPROVAL',
      'EXECUTING',
      'TESTING',
      'ANALYZING_FAILURE',
      'FIXING',
      'TESTING',
    ] as const) {
      machine.transition(state, state);
    }
    expect(machine.state).toBe('TESTING');
    const resumed = new AgentStateMachine(() => new Date('2026-09-24T00:00:00.000Z'), 'VALIDATING');
    resumed.transition('WAITING_FOR_APPROVAL', 'approve publish');
    expect(resumed.state).toBe('WAITING_FOR_APPROVAL');
    expect(resumed.transitions[0]?.reason).toBe('resumed');
    expect(machine.transitions).toHaveLength(9);
  });
});
