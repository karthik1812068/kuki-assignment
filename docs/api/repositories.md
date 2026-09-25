# Repository API

These routes require the session cookie. They return repositories for the signed-in user only. A missing record is `404`. The GitHub access token is not included.

`indexing` is `not_started` until a job is queued. It then moves through `queued`, `running`, and `completed` or `failed`. `embeddingModel` is `local-hash-v1` after a completed index, or null.

## `GET /repositories`

Imported repositories for the current user.

## `GET /repositories/github`

Repositories GitHub returns for the current token, up to three pages. `409` with `GITHUB_NOT_CONNECTED` when the account has no stored token. `503` with `GITHUB_UNAVAILABLE` when GitHub does not answer. The next-page link is followed only when it stays on `https://api.github.com`.

## `POST /repositories`

```json
{ "fullName": "octocat/hello" }
```

Confirms the repository with GitHub, stores metadata, and clones the default branch with `git clone --depth 1`. The token is passed to Git through the process environment, not the command arguments. The clone path is not returned.

`fullName` must be `owner/name` using letters, numbers, `.`, `_`, and `-`.

The response is the imported repository. `status` is `cloned` or `clone_failed`. `cloneError` is a fixed message, not Git output.

## `GET /repositories/:id`

Metadata for one imported repository.

## `GET /repositories/:id/status`

```json
{
  "id": "…",
  "status": "cloned",
  "cloneError": null,
  "indexing": "not_started",
  "indexedAt": null
}
```

## `POST /repositories/:id/index`

`202` with the repository. The API sets indexing to `queued` and pushes a job. It does not scan files on this request.

`409` `CLONE_REQUIRED` when the repository is not cloned. `503` `INDEX_QUEUE_UNAVAILABLE` when Redis does not accept the job.

## `GET /repositories/:id/search?q=`

`q` is 1–200 characters. The response is `{ "indexing", "hits" }`. Hits are empty until indexing is `completed`.

Each hit has `path`, `symbol`, `language`, `startLine`, `endLine`, `excerpt`, `semanticScore`, `keywordScore`, and `symbolScore`. Those scores are measured from the local hash vector, token overlap, and the symbol name. The sort key is `0.5 * semantic + 0.35 * keyword + 0.15 * symbol`. The excerpt is at most 400 characters. The clone path and token are not included.
