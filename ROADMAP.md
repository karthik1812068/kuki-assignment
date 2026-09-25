# Roadmap

Work one phase at a time. A phase starts only after the previous phase is accepted.

| Phase | Focus                                                                  | Status   |
| ----- | ---------------------------------------------------------------------- | -------- |
| 0     | Monorepo, web shell, API, worker, Postgres, Redis, Docker, CI          | Complete |
| 1     | GitHub OAuth, user, session, protected routes                          | Complete |
| 2     | Repository listing, selection, clone, metadata                         | Complete |
| 3     | File scanning, parsing, chunking, embeddings, semantic search          | Complete |
| 4     | LLM service, prompts, tool definitions, agent state machine            | Complete |
| 5     | Read-only repository tools and planning                                | Complete |
| 6     | File edits, diffs, human approval                                      | Complete |
| 7     | Docker sandbox and test, lint, typecheck, and build commands           | Complete |
| 8     | Failure analysis and bounded repair loop                               | Complete |
| 9     | Branch, status, diff, commit, push                                     | Complete |
| 10    | Pull request creation                                                  | Complete |
| 11    | Code and security review                                               | Complete |
| 12    | Evaluation benchmarks and dashboard                                    | Complete |
| 13    | AWS, Terraform, monitoring, rate limiting, backups, secrets management | Complete |

## Phase 0 exit

The foundation is complete when:

- `npm test` passes
- `npm run lint`, `npm run typecheck`, and `npm run build` pass
- Postgres and Redis come up with Docker Compose
- `GET /health` and `GET /ready` behave as documented
- The web shell renders the foundation pages
- No model provider is registered

## Phase 1 exit

Authentication is complete when:

- `GET /auth/github` redirects to GitHub when OAuth is configured, and back to `/login` when it is not
- The callback stores a user and an encrypted token, then sets an HttpOnly session cookie
- `GET /auth/me` returns the public profile and granted scopes, or `401`
- `POST /auth/logout` revokes that session
- Workspace pages redirect to `/login` without a session
- The GitHub access token is absent from API responses and from the web app

## Phase 2 exit

Repository import is complete when:

- `GET /repositories/github` lists repositories for the signed-in token
- `POST /repositories` stores metadata and clones the default branch
- `GET /repositories` and `GET /repositories/:id` return only that user's records
- The token and clone path are absent from responses
- Indexing stays `not_started`

## Phase 3 exit

Indexing is complete when:

- `POST /repositories/:id/index` queues a cloned repository and returns without scanning it
- The worker stores files, symbol chunks, and local embeddings for that owner only
- Secret and generated paths are not stored
- `GET /repositories/:id/search` ranks that repository's chunks and does not call a model
- Indexing status is `not_started` until a job is queued

## Phase 4 exit

The model boundary is complete when:

- A completion client exists only when `LLM_API_KEY` and `LLM_MODEL` are set
- Prompts keep repository text in an untrusted-data section
- All 25 tools have input rules, and none can be executed
- The state machine records every allowed transition and rejects the rest
- `GET /agent` reports that status without the API key

## Phase 5–13 exit

The workflow is complete when:

- A task can inspect a clone, propose a plan, and wait for approval
- Approved edits produce a diff in a separate workspace
- Tests run only through the fixed Docker sandbox
- Repair stops at the configured limit
- Commit, push, and pull request creation wait for a second approval
- Review findings are stored and do not silently rewrite security-sensitive code
- The dashboard shows measured task counts, and cost stays empty until prices are configured
- Task creation is rate limited, and the Terraform file creates no cloud resources

## Next

The product workflow is implemented. A live GitHub login, a running database, a model key, and a local Docker engine are still required before an end-to-end task can finish on this machine.
