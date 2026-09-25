# ADR 0002 — GitHub OAuth sessions

## Status

Accepted

## Context

Phase 1 needs GitHub login, a current user, and protected workspace pages. The GitHub access token must not reach the browser. `JWT_SECRET` was reserved in the foundation environment, but a JWT is not required to represent a session.

## Decision

- Use the GitHub authorization-code flow with a one-time `state` value in Redis and PKCE.
- Store the user in `users` and the access token in `github_credentials` as an AES-256-GCM payload. The encryption key is SHA-256 of `ENCRYPTION_KEY`.
- Store sessions in Postgres. The cookie value is a random session id. Logout revokes that row.
- Return only the public profile and granted OAuth scopes from `GET /auth/me`.
- Protect the workspace pages in the web app. Health checks stay public.
- Leave `JWT_SECRET` unused.
- Request the `repo` scope so a later import can read repositories the user can access. This phase does not call the repository list API.

## Consequences

- Sign-in does nothing useful until the GitHub OAuth app and `ENCRYPTION_KEY` are set. The API still boots without them.
- The session cookie is scoped to the API hostname. Local development works because the web app and API both use `localhost`.
- Redis losing the OAuth state only interrupts an in-progress login. Existing sessions stay in Postgres.
- Per-repository permission checks belong to the repository phase.
