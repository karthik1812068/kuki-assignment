import { AGENT_STATES, type AgentState } from '@codepilot/types';

export interface AgentTransition {
  from: AgentState | null;
  to: AgentState;
  at: string;
  reason: string;
}

const NEXT: Record<AgentState, readonly AgentState[]> = {
  CREATED: ['ANALYZING', 'CANCELLED'],
  ANALYZING: ['PLANNING', 'FAILED', 'CANCELLED'],
  PLANNING: ['WAITING_FOR_APPROVAL', 'FAILED', 'CANCELLED'],
  WAITING_FOR_APPROVAL: ['EXECUTING', 'FAILED', 'CANCELLED'],
  EXECUTING: ['TESTING', 'WAITING_FOR_APPROVAL', 'FAILED', 'CANCELLED'],
  TESTING: ['VALIDATING', 'ANALYZING_FAILURE', 'FAILED', 'CANCELLED'],
  ANALYZING_FAILURE: ['FIXING', 'FAILED', 'CANCELLED'],
  FIXING: ['TESTING', 'FAILED', 'CANCELLED'],
  VALIDATING: ['COMPLETED', 'FAILED', 'CANCELLED', 'WAITING_FOR_APPROVAL'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export class AgentTransitionError extends Error {
  override readonly name = 'AgentTransitionError';

  constructor(
    readonly from: AgentState,
    readonly to: AgentState,
  ) {
    super('That agent transition is not allowed.');
  }
}

export class AgentStateMachine {
  readonly transitions: AgentTransition[] = [];
  private current: AgentState = 'CREATED';

  constructor(
    private readonly now: () => Date = () => new Date(),
    initial: AgentState = 'CREATED',
  ) {
    if (!AGENT_STATES.includes(initial)) {
      throw new AgentTransitionError('CREATED', initial);
    }
    this.current = initial;
    this.transitions.push({
      from: null,
      to: initial,
      at: this.now().toISOString(),
      reason: initial === 'CREATED' ? 'created' : 'resumed',
    });
  }

  get state(): AgentState {
    return this.current;
  }

  transition(to: AgentState, reason: string): AgentTransition {
    if (!AGENT_STATES.includes(to) || !NEXT[this.current].includes(to)) {
      throw new AgentTransitionError(this.current, to);
    }
    const clean = cleanReason(reason);
    if (!clean) {
      throw new AgentTransitionError(this.current, to);
    }
    const entry: AgentTransition = {
      from: this.current,
      to,
      at: this.now().toISOString(),
      reason: clean,
    };
    this.transitions.push(entry);
    this.current = to;
    return entry;
  }
}

function cleanReason(value: string): string | null {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 31 && code !== 127) {
      result += char;
    }
  }
  const trimmed = result.trim();
  if (trimmed.length === 0 || trimmed.length > 200) {
    return null;
  }
  return trimmed;
}
