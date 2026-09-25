# ADR 0001 — Foundation layout

## Status

Accepted

## Context

The repository was empty. Phase 0 needs a TypeScript monorepo, a web shell, an API, a worker process, Postgres, Redis, and CI. It must not call a model or modify repositories.

## Decision

- The Cursor workspace root is the monorepo root. The npm package name is `codepilot-ai`.
- npm workspaces link `apps/*` and `packages/*`.
- Shared packages compile to CommonJS so the NestJS API can load them.
- TypeScript 5.9.3 is pinned with an npm override. NestJS 12's schematics peer-depend on TypeScript 6 or newer, which removes the module settings this codebase uses. The override keeps one compiler that still supports decorator metadata and the current lint rules.
- Configuration is validated with Zod. GitHub and LLM secrets are optional until later phases.
- PostgreSQL migrations use Drizzle's migrator. Phase 0 does not create product tables.
- The local Postgres image is `pgvector/pgvector:pg16` so Phase 3 can enable `pgvector` without replacing the image. The extension is not created yet.
- Redis connectivity lives in `@codepilot/database` because the prescribed package list has no separate cache package. Queue consumers are not implemented.
- `@codepilot/ai` exports a provider interface and an empty registration list.
- `@codepilot/tools` exports the planned tool catalog and records that nothing is implemented.
- Shell execution is rejected by lint. There is no sandbox runner yet.

## Consequences

- Package builds must run before the API, agent, or production image starts.
- Application tables, OAuth, indexing, and agent execution remain later phases.
- A dedicated vector database would be a new decision, not a change to this layout.
