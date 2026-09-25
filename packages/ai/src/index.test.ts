import { describe, expect, it } from 'vitest';
import { llmProviderFromEnv } from './index';

describe('llm runtime', () => {
  it('does not register a provider without a key and model', () => {
    expect(llmProviderFromEnv({})).toBeNull();
  });
});
