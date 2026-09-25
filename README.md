# CodePilot AI

Engineering workspace for understanding a repository, planning a change, and reviewing the result. This build can sign in with GitHub, clone a repository, index it, and run an approval-gated task. Edits, sandbox commands, and pull requests wait for approval. A model call happens only when `LLM_API_KEY` and `LLM_MODEL` are both set.

## Phase

Phases 0 through 13 are implemented. A task still needs Postgres, Redis, a cloned repository, and, for publish, GitHub credentials. The sandbox needs Docker on the worker machine.

## Prerequisites

- Node.js 22
- npm 10
- Docker, for Postgres and Redis

## Local setup

```bash
npm install
docker compose up postgres redis -d
npm run db:migrate
npm run dev
```

- Web: http://localhost:3000
- API liveness: http://localhost:4000/health
- API readiness: http://localhost:4000/ready

Copy `.env.example` to `.env` if you do not already have one. The sample database password is for local Docker only. Values already set in the shell take precedence over `.env`.

GitHub sign-in also needs `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, and `ENCRYPTION_KEY` (at least 32 characters). The callback URL is the API route `http://localhost:4000/auth/github/callback`. Without those values the API still starts, and the sign-in button explains that OAuth is not configured.

If port 5432 or 6379 is already in use, choose other host ports and point the URLs at them:

```bash
POSTGRES_PORT=55432 REDIS_PORT=6380 docker compose up postgres redis -d
```

Then set `DATABASE_URL` and `REDIS_URL` to those host ports before `npm run db:migrate` and `npm run dev`.

`npm run dev` builds the shared packages, then starts the API, web app, and agent worker. The worker waits on the index queue after it can reach Postgres and Redis. It does not call a model.

The full container stack, including the apps, is:

```bash
docker compose up --build
```

## Scripts

| Command                    | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| `npm run dev`              | Build packages and start web, API, and the worker |
| `npm run build`            | Production build                                  |
| `npm run typecheck`        | Build packages, then typecheck every workspace    |
| `npm run lint`             | Lint packages, API, worker, and web               |
| `npm test`                 | Unit tests. Docker is not required                |
| `npm run test:integration` | Postgres migration, Postgres ping, and Redis ping |
| `npm run db:migrate`       | Apply SQL migrations                              |
| `npm run format`           | Format the repository                             |

## Layout

```text
apps/web        Next.js workspace shell
apps/api        NestJS HTTP API
apps/agent      Index and task worker. Edits run in a workspace, and commands run in Docker.
packages/*      Shared TypeScript packages
infrastructure  Dockerfiles and placeholders for later AWS work
```

## What still depends on the machine

- GitHub OAuth credentials and a reachable Postgres and Redis
- A model key, if a task should propose edits instead of a search-only plan
- Docker, if sandbox tests should run
- Applying Terraform, which currently defines no cloud resources

Indexing is local. `POST /repositories/:id/index` queues work. The worker scans the clone, skips secrets and generated files, and stores hashed vectors. Search does not send repository text to a model.

A model completion is possible only after `LLM_API_KEY` and `LLM_MODEL` are set, and only when a later phase calls the client. This phase does not call it. `GET /agent` reports whether that client can be created.

Product requirements live in [PRD.md](PRD.md). The current shape of the system is in [ARCHITECTURE.md](ARCHITECTURE.md). The phase list is in [ROADMAP.md](ROADMAP.md).
