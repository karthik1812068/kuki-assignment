export interface LlmCompletionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmCompletionResult {
  text: string;
  usage: LlmUsage;
}

export interface LlmProvider {
  readonly id: string;
  readonly model: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}

export interface LlmClientConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class LlmRequestError extends Error {
  override readonly name = 'LlmRequestError';

  constructor(readonly reason: 'unavailable' | 'invalid_response' | 'timeout') {
    super(
      reason === 'timeout'
        ? 'The language model request timed out.'
        : reason === 'invalid_response'
          ? 'The language model response was not usable.'
          : 'The language model request failed.',
    );
  }
}

const PROVIDER_ID = 'openai-compatible';

export function createLlmProvider(config: LlmClientConfig): LlmProvider {
  const endpoint = chatCompletionsUrl(config.baseUrl);
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 30_000;

  return {
    id: PROVIDER_ID,
    model: config.model,
    async complete(request) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: request.model,
            temperature: 0,
            max_tokens: request.maxOutputTokens,
            messages: [
              { role: 'system', content: request.systemPrompt },
              { role: 'user', content: request.userPrompt },
            ],
          }),
        });
        if (response.status >= 300 && response.status < 400) {
          throw new LlmRequestError('unavailable');
        }
        if (!response.ok) {
          throw new LlmRequestError('unavailable');
        }
        const raw = await response.text();
        if (raw.length > 1_000_000) {
          throw new LlmRequestError('invalid_response');
        }
        return parseCompletion(raw);
      } catch (error) {
        if (error instanceof LlmRequestError) {
          throw error;
        }
        if (isAbort(error)) {
          throw new LlmRequestError('timeout');
        }
        throw new LlmRequestError('unavailable');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function chatCompletionsUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  const path = url.pathname.replace(/\/$/, '');
  url.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
  return url.toString();
}

function parseCompletion(raw: string): LlmCompletionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LlmRequestError('invalid_response');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new LlmRequestError('invalid_response');
  }
  const record = parsed as Record<string, unknown>;
  const choices = record.choices;
  const usage = record.usage;
  if (!Array.isArray(choices) || !usage || typeof usage !== 'object') {
    throw new LlmRequestError('invalid_response');
  }
  const first: unknown = choices[0];
  if (!first || typeof first !== 'object') {
    throw new LlmRequestError('invalid_response');
  }
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') {
    throw new LlmRequestError('invalid_response');
  }
  const text = (message as Record<string, unknown>).content;
  const inputTokens = (usage as Record<string, unknown>).prompt_tokens;
  const outputTokens = (usage as Record<string, unknown>).completion_tokens;
  if (typeof text !== 'string' || text.length > 100_000) {
    throw new LlmRequestError('invalid_response');
  }
  if (!isTokenCount(inputTokens) || !isTokenCount(outputTokens)) {
    throw new LlmRequestError('invalid_response');
  }
  return { text, usage: { inputTokens, outputTokens } };
}

function isTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10_000_000;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
