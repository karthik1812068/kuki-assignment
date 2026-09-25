import { createLlmProvider, type LlmProvider } from './provider';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export function llmProviderFromEnv(env: {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): LlmProvider | null {
  if (!env.apiKey || !env.model) {
    return null;
  }
  return createLlmProvider({
    apiKey: env.apiKey,
    model: env.model,
    baseUrl: env.baseUrl ?? DEFAULT_BASE_URL,
  });
}
