# Production notes

Local Postgres and Redis come from Docker Compose. `npm run db:migrate` applies the SQL migrations, including tasks and audit logs.

The agent worker needs the same `REPOSITORIES_DIR` as the API, plus a writable sibling directory for task workspaces. GitHub push needs `ENCRYPTION_KEY` so the worker can decrypt the stored token. The token is not written to logs.

Sandbox commands run as `docker run` on a machine where Docker is installed. The worker does not receive the host environment. The Compose agent service does not mount the Docker socket.

Rate limiting for task creation uses Redis. Backups are an operator step: dump Postgres and keep the repository volume. This repository does not schedule those backups or apply the Terraform placeholder.

Set `LLM_INPUT_USD_PER_MILLION` and `LLM_OUTPUT_USD_PER_MILLION` together when a cost figure should be stored. Leave them unset to keep cost null.
