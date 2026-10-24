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
  ],
  "work": {
    "index": { "waiting": 0, "processing": 0, "dead": 0 },
    "task": { "waiting": 0, "processing": 0, "dead": 0 },
    "workerSeenAt": null,
    "workerLive": false
  }
}
```

`provider` is `openai-compatible` only when both `LLM_API_KEY` and `LLM_MODEL` are set. Otherwise both `provider` and `model` are null.

`work` is Redis queue depth plus the worker heartbeat. `workerLive` is true only when the worker wrote that key in the last 45 seconds. Missing Redis data is returned as zeros, not as a 500. The API key is still omitted.

Completions, when configured, go to `LLM_BASE_URL` or `https://api.openai.com/v1`. The client does not follow redirects. Token counts come from the provider response. A missing usage field is rejected rather than filled in.

No task is stored. The state machine records transitions in memory for later phases.
