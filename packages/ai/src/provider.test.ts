import { describe, expect, it } from 'vitest';
import { chatCompletionsUrl, createLlmProvider, LlmRequestError } from './provider';
import { llmProviderFromEnv } from './register';

describe('llm provider', () => {
  it('stays unregistered until a key and model are set', () => {
    expect(llmProviderFromEnv({})).toBeNull();
    expect(llmProviderFromEnv({ apiKey: 'x'.repeat(20) })).toBeNull();
    expect(llmProviderFromEnv({ apiKey: 'x'.repeat(20), model: 'gpt-test' })?.id).toBe(
      'openai-compatible',
    );
  });

  it('reads measured token counts and does not echo the key or response body', async () => {
    const secret = 'sk-test-secret-value';
    let authorization = '';
    const provider = createLlmProvider({
      apiKey: secret,
      model: 'gpt-test',
      baseUrl: 'https://example.test/v1',
      fetchImpl: (_url, init) => {
        authorization = new Headers(init?.headers).get('authorization') ?? '';
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: `echo ${secret}` } }],
              usage: { prompt_tokens: 11, completion_tokens: 3 },
            }),
            { status: 500 },
          ),
        );
      },
    });

    await expect(
      provider.complete({
        model: 'gpt-test',
        systemPrompt: 'system',
        userPrompt: 'user',
        maxOutputTokens: 20,
      }),
    ).rejects.toThrow(LlmRequestError);
    try {
      await provider.complete({
        model: 'gpt-test',
        systemPrompt: 'system',
        userPrompt: 'user',
        maxOutputTokens: 20,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(LlmRequestError);
      expect(String(error)).not.toContain(secret);
    }
    expect(authorization).toBe(`Bearer ${secret}`);
  });

  it('returns the provider usage on success', async () => {
    const provider = createLlmProvider({
      apiKey: 'sk-test-secret-value',
      model: 'gpt-test',
      baseUrl: 'https://example.test/v1',
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'A short plan.' } }],
              usage: { prompt_tokens: 11, completion_tokens: 3 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
    });
    const result = await provider.complete({
      model: 'gpt-test',
      systemPrompt: 'system',
      userPrompt: 'user',
      maxOutputTokens: 20,
    });
    expect(result.text).toBe('A short plan.');
    expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 3 });
  });

  it('builds the chat completions URL from the API root', () => {
    expect(chatCompletionsUrl('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
  });
});
