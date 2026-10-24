# CodePilot AI

GitHub-backed workspace: clone a repo, index it on the machine, then run a task. Edits, sandbox commands, and PRs wait for approval. LLM calls only happen if `LLM_API_KEY` and `LLM_MODEL` are set.

## What you need

- Node 22
- npm 10
- Docker (Postgres + Redis, and the command sandbox)

## Setup

```bash
npm install
docker compose up postgres redis -d
npm run db:migrate
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/health (readiness is `/ready`)

Copy `.env.example` to `.env` if you don't have one yet. Vars already in the shell override the file. The sample DB password is only for local compose.

GitHub login also needs `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, and `ENCRYPTION_KEY` (32+ chars). Callback URL is `http://localhost:4000/auth/github/callback`. Without those the API still starts; the login button just says OAuth isn't set up.

If 5432 or 6379 is taken:

```bash
POSTGRES_PORT=55432 REDIS_PORT=6380 docker compose up postgres redis -d
```

Point `DATABASE_URL` and `REDIS_URL` at those host ports, then migrate and `npm run dev` again.

`npm run dev` builds the shared packages and starts web, API, and the worker. The worker watches Redis. Indexing does not call a model.

Full stack in containers:

```bash
docker compose up --build
```

## Scripts

- `npm run dev` — packages + web + API + worker
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm test` — unit tests, including the document eval suite (no Docker)
- `npm run test:integration` — Postgres + Redis pings
- `npm run db:migrate`
- `npm run format`

## Layout

```text
apps/web          Next.js app
apps/api          NestJS API
apps/agent        worker (index + tasks)
packages/indexing clone search, plus document extract / Q&A under src/docs
packages/*        other shared libs
docs/             API notes and eval fixtures (see docs/INDEX.md)
infrastructure    Docker / later AWS bits
```

## Notes

Indexing is local. `POST /repositories/:id/index` just queues a job. The worker walks the clone, skips secrets and build output, and stores hashed vectors. Search does not send repo text to a hosted embedding model.

`GET /agent` says whether an LLM client can be created. Nothing in the index path uses it.

**Documents:** after sign-in you can upload pdf / xlsx / csv / txt. Each file is its own job (queued → processing → completed / failed / duplicate). Status sits in Postgres so a restart doesn't wipe it. If the worker dies mid-job, that payload goes back on the wait list next start. Three thrown failures and it lands on the dead list instead of looping.

Indian FY labels: `FY 2023-24` and `financial year 2024` both mean FY2024 (year ending 31 Mar 2024).

**Evaluation:** `/evaluation` in the app, or `npm test`. Cases are in `packages/indexing/src/docs/cases.ts`, fixtures in `docs/evaluation/fixtures`. More notes in [docs/evaluation/README.md](docs/evaluation/README.md).

Longer writeups: [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md).
