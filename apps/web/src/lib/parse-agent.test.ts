import { describe, expect, it } from 'vitest';
import { AGENT_STATES } from '@codepilot/types';
import { parseAgentStatus } from './parse-agent';

describe('parseAgentStatus', () => {
  it('keeps the public status and drops a key', () => {
    const status = parseAgentStatus({
      provider: null,
      model: null,
      toolCount: 25,
      toolExecution: false,
      states: [...AGENT_STATES],
      apiKey: 'sk-secret-value',
    });
    expect(status?.provider).toBeNull();
    expect(status?.toolExecution).toBe(false);
    expect(status).not.toHaveProperty('apiKey');
    expect(JSON.stringify(status)).not.toContain('sk-secret-value');
  });
});
