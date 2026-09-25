# Architecture

The worker queues indexing and tasks. A model client is created only when a key and model are configured. Edits, sandbox commands, and publishing wait for approval.

## Runtime

```text
Browser
  → Next.js web (port 3000)
  → NestJS API (port 4000)
       → PostgreSQL
       → Redis

Agent worker
  → PostgreSQL
  → Redis
```

The browser calls `GET /ready` for measured dependency status. Sign-in starts in the browser, finishes on the API, and returns the user to the web app with an HttpOnly session cookie. `POST /repositories/:id/index` only enqueues work. The worker reads that Redis queue and writes the index.

The worker does not call a language model while indexing. Embeddings stay the local hash, `local-hash-v1`, stored in pgvector. `GET /agent` reports whether `LLM_API_KEY` and `LLM_MODEL` are set. See [docs/api/agent.md](docs/api/agent.md).

## Packages

| Package               | Responsibility in this phase                                             |
| --------------------- | ------------------------------------------------------------------------ |
| `@codepilot/config`   | Load the repository `.env` and validate it                               |
| `@codepilot/logger`   | JSON logs, secret redaction, request context                             |
| `@codepilot/types`    | Health report, API error body, agent state names                         |
| `@codepilot/database` | Postgres pool, Redis client, SQL migrations                              |
| `@codepilot/security` | Redaction, token encryption, path confinement, repository ignore rules   |
| `@codepilot/ai`       | Provider interface, still empty, plus the local hash embedding           |
| `@codepilot/indexing` | Scan, ignore, symbol chunking, detection, and search ranking             |
| `@codepilot/github`   | OAuth, profile reads, and repository listing. Clone arguments stay fixed |
| `@codepilot/tools`    | Planned tool catalog. `implemented` is false                             |

Packages compile to `dist` before the API or worker loads them.

## API

- `GET /health` answers from the process.
- `GET /ready` pings Postgres and Redis, returns 503 when either check fails, and omits internal error text.
- `GET /auth/github`, `GET /auth/github/callback`, `POST /auth/logout`, and `GET /auth/me` implement GitHub sign-in. See [docs/api/auth.md](docs/api/auth.md).
- Repository routes list, import, enqueue indexing, and search the signed-in user's index. See [docs/api/repositories.md](docs/api/repositories.md).
- Requests receive an `x-request-id`. Authenticated requests also log `userId`. `repositoryId`, `taskId`, and `agentRunId` are still unused.
- Configuration is read from the environment. Blank GitHub and LLM secrets are treated as unset. Sign-in stays disabled until the OAuth values and `ENCRYPTION_KEY` are present.

## Data

Drizzle's migrator applies `packages/database/migrations`. Auth adds `users`, `github_credentials`, and `sessions`. Import adds `repositories`. Indexing adds `repository_files`, `code_chunks`, and `embeddings`, and enables the `vector` extension. The GitHub token is stored only as ciphertext. Clone directories live under `data/repositories` or `REPOSITORIES_DIR` and are not returned by the API. Compose mounts one volume at that path for the API and the worker.

## Web

The home page and `/login` are public. Dashboard, repositories, tasks, and settings require a session. Those pages still describe missing product data. They do not invent usage, success, or cost figures. Infrastructure latency on the dashboard comes from `/ready`. Settings lists the OAuth scopes stored for the signed-in user.

## Security boundary

Repository commands are not executed. The indexer reads file text as data and skips secret and generated paths. `child_process` stays banned except the fixed git clone. See [docs/security/foundation.md](docs/security/foundation.md) and [docs/decisions/0004-local-index.md](docs/decisions/0004-local-index.md).

## Later phases

Authentication, GitHub import, indexing, retrieval, the agent loop, sandboxed execution, git, and pull requests stay behind explicit phase approval. The provider interface and tool catalog are the extension points. They are not implementations.
