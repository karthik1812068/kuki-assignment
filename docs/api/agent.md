# Agent boundary

`GET /agent` requires the session cookie. It reports whether a language model can be called. It does not call one, and it does not return the API key or base URL.

```json
{
  "provider": null,
  "model": null,
  "toolCount": 25,
  "toolExecution": false,
  "states": [
    "CREATED",
    "ANALYZING",
    "PLANNING",
    "WAITING_FOR_APPROVAL",
    "EXECUTING",
    "TESTING",
    "ANALYZING_FAILURE",
    "FIXING",
    "VALIDATING",
    "COMPLETED",
    "FAILED",
    "CANCELLED"
  ]
}
```

`provider` is `openai-compatible` only when both `LLM_API_KEY` and `LLM_MODEL` are set. Otherwise both `provider` and `model` are null.

`toolExecution` is true when handlers are installed. Read tools do not require approval. Write, execute, git, and GitHub tools do, and they run in the worker.

Completions, when configured, go to `LLM_BASE_URL` or `https://api.openai.com/v1`. The client does not follow redirects. Token counts come from the provider response. A missing usage field is rejected rather than filled in.

No task is stored. The state machine records transitions in memory for later phases.
