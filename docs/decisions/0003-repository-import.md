# ADR 0003 — Repository import

## Status

Accepted

## Context

Phase 2 needs the signed-in user to see GitHub repositories, choose one, and clone it. The clone has to be a real Git checkout for later branches and pull requests. The sandbox that runs repository commands does not exist yet. Indexing is the next phase.

## Decision

- List and confirm repositories through the GitHub API with the stored token.
- Persist metadata on `repositories`, scoped by `owner_id`.
- Clone with `git clone --depth 1` of `https://github.com/<owner>/<name>.git`. The branch and full name are validated. The token is an `http.extraheader` value in the child environment.
- Keep the clone path on disk only. API responses expose status, not the path or the token.
- Return `indexing: not_started`. `POST /repositories/:id/index` answers `501`.

## Consequences

- `git` must be installed on the API host. A missing binary is stored as `clone_failed` with a fixed message.
- Cloned files are untrusted. This phase does not execute them.
- A shallow clone is enough to read the default branch. Later Git operations may need a deeper fetch.
