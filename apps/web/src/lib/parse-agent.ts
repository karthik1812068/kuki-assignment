import { AGENT_STATES, type AgentState } from '@codepilot/types';

export interface AgentStatus {
  provider: 'openai-compatible' | null;
  model: string | null;
  toolCount: number;
  toolExecution: boolean;
  states: AgentState[];
}

const MODEL = /^[A-Za-z0-9._:/-]{1,80}$/;

export function parseAgentStatus(value: unknown): AgentStatus | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.toolExecution !== 'boolean' || !Array.isArray(record.states)) {
    return null;
  }
  if (!sameStates(record.states)) {
    return null;
  }
  if (
    typeof record.toolCount !== 'number' ||
    !Number.isInteger(record.toolCount) ||
    record.toolCount < 0
  ) {
    return null;
  }
  const provider =
    record.provider === null
      ? null
      : record.provider === 'openai-compatible'
        ? 'openai-compatible'
        : undefined;
  if (provider === undefined) {
    return null;
  }
  const model =
    record.model === null
      ? null
      : typeof record.model === 'string' && MODEL.test(record.model)
        ? record.model
        : undefined;
  if (model === undefined) {
    return null;
  }
  if (provider === null && model !== null) {
    return null;
  }
  return {
    provider,
    model,
    toolCount: record.toolCount,
    toolExecution: record.toolExecution,
    states: [...AGENT_STATES],
  };
}

function sameStates(value: unknown[]): boolean {
  if (value.length !== AGENT_STATES.length) {
    return false;
  }
  return AGENT_STATES.every((state, index) => value[index] === state);
}
