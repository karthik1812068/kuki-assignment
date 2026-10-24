import { AGENT_STATES, type AgentState } from '@codepilot/types';

export interface QueueCounts {
  waiting: number;
  processing: number;
  dead: number;
}

export interface WorkSnapshot {
  index: QueueCounts;
  task: QueueCounts;
  documents: QueueCounts;
  workerSeenAt: string | null;
  workerLive: boolean;
}

export interface AgentStatus {
  provider: 'openai-compatible' | null;
  model: string | null;
  toolCount: number;
  toolExecution: boolean;
  states: AgentState[];
  work: WorkSnapshot | null;
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
    work: parseWorkSnapshot(record.work),
  };
}

export function parseWorkSnapshot(value: unknown): WorkSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const index = parseQueueCounts(record.index);
  const task = parseQueueCounts(record.task);
  const documents = parseQueueCounts(record.documents) ?? {
    waiting: 0,
    processing: 0,
    dead: 0,
  };
  if (!index || !task || typeof record.workerLive !== 'boolean') {
    return null;
  }
  if (record.workerSeenAt !== null && typeof record.workerSeenAt !== 'string') {
    return null;
  }
  return {
    index,
    task,
    documents,
    workerSeenAt: typeof record.workerSeenAt === 'string' ? record.workerSeenAt : null,
    workerLive: record.workerLive,
  };
}

function parseQueueCounts(value: unknown): QueueCounts | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.waiting !== 'number' ||
    typeof record.processing !== 'number' ||
    typeof record.dead !== 'number'
  ) {
    return null;
  }
  return {
    waiting: record.waiting,
    processing: record.processing,
    dead: record.dead,
  };
}

function sameStates(value: unknown[]): boolean {
  if (value.length !== AGENT_STATES.length) {
    return false;
  }
  return AGENT_STATES.every((state, index) => value[index] === state);
}
