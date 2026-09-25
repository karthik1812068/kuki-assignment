# Tasks

Creating a task requires a session and a cloned repository. The API queues the job and returns `202`. It does not run the agent on the request.

`POST /tasks`

```json
{
  "repositoryId": "uuid",
  "title": "Update greeting",
  "description": "Change the text.",
  "mode": "implement"
}
```

`mode` is `implement`, `review`, `security`, `docs`, or `issue`. Review and security modes do not edit files. Documentation edits are limited to Markdown. Issue mode reads a `#number` from the description when GitHub is connected.

`GET /tasks` lists the caller's tasks. `GET /tasks/:id` returns the plan, diff, sandbox results, findings, token counts, and pull request. It does not return the GitHub token or a clone path.

`POST /tasks/:id/decision` accepts `approve`, `reject`, or `cancel` while the task is waiting. Approval of the plan allows edits and the sandbox. A second approval allows the branch, commit, push, and pull request.

`GET /tasks/summary` returns measured counts. Average duration is null until a task has both start and completion times. Estimated cost is null until both `LLM_INPUT_USD_PER_MILLION` and `LLM_OUTPUT_USD_PER_MILLION` are set.

`GET /tasks/:id/events` streams status events for a short interval. The page also refreshes while the task is unfinished.

Task creation is limited per account. The default is 20 tasks an hour.
