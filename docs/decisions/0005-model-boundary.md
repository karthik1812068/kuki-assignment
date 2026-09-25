# Language-model boundary

## Status

Accepted for Phase 4.

## Decision

The model client speaks the OpenAI chat-completions shape and is created only when `LLM_API_KEY` and `LLM_MODEL` are both set. `LLM_BASE_URL` defaults to `https://api.openai.com/v1`. `http` is accepted only for `localhost` and `127.0.0.1`. Redirects are not followed. Failures use a fixed message so response bodies and the API key are not returned.

Prompts are separate for the orchestrator, planner, tool selection, observation, and validation. Repository text is placed under an untrusted-data label. The system prompt tells the model not to follow instructions in that data.

Tool definitions now include input fields, permission, approval, timeout policy, and the error codes `INVALID_INPUT` and `NOT_IMPLEMENTED`. `validateToolInput` checks shape and path safety. `toolRuntime.implemented` stays false, so nothing in this phase runs a tool.

The agent state machine allows only the transitions listed in code and appends every transition, including the initial `CREATED` entry. Terminal states have no exits. Runs are not stored, because no task is created yet.

## Consequences

A configured key can spend money only when a later phase calls `complete`. This phase does not. Usage figures are whatever the provider returns. Cost is not estimated here.

Switching providers means another client behind the same `LlmProvider` interface. The status endpoint's provider id would change with that client.
