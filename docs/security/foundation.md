# Foundation security controls

This build includes:

- Environment parsing that reports field names and does not echo rejected secret values.
- Structured logs that redact common secret fields.
- A repository path policy that blocks environment files, private keys, dependency folders, build output, and common binaries. The indexer calls this policy before reading a file and does not execute repository contents.
- Path resolution that rejects absolute paths, null bytes, and paths that leave a repository root.
- An ESLint ban on `child_process`. There is no command runner.
- The model client is created only when a key and model are configured. Prompts label repository text as untrusted data. This phase does not call the client. Tool handlers are not installed.
- Helmet, CORS limited to the web origin, and request ids that reject log-breaking values.
- GitHub client secrets and the encryption key stay on the server. The session cookie is HttpOnly and does not contain the GitHub token.
- OAuth `state` is single-use. Login redirects ignore paths outside the workspace.
- Repository import runs one fixed `git clone`. The token is not placed in the command arguments, and Git output is not returned to the client.
- Avatar URLs are kept only when they are `https://avatars.githubusercontent.com`.

Not in this build:

- Role-based access beyond "this session belongs to this user".
- Rate limiting.
- Rate limiting.
- Audit log storage.
- The Docker sandbox for repository commands.
- Prompt-injection defenses inside an agent loop.

The local Docker Compose password `codepilot` is for the development database only.
