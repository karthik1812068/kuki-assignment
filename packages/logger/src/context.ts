import { AsyncLocalStorage } from 'node:async_hooks';

export interface LogContext {
  requestId?: string;
  userId?: string;
  repositoryId?: string;
  taskId?: string;
  agentRunId?: string;
}

export const requestContext = new AsyncLocalStorage<LogContext>();

export function getLogContext(): LogContext {
  return requestContext.getStore() ?? {};
}
