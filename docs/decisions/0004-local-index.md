# Local repository index

## Status

Accepted for Phase 3.

## Decision

`POST /repositories/:id/index` checks ownership and clone status, then pushes `{ repositoryId, ownerId }` to Redis. The API response does not wait for the scan.

The worker reads the clone from `REPOSITORIES_DIR` or `data/repositories/<ownerId>/<repositoryId>`. It skips paths rejected by the repository ignore policy, including `.env`, private keys, `node_modules`, and build output. It does not follow symlinks and it does not execute repository files. Lockfiles are used only as package-manager markers and are not chunked.

Chunks are symbol spans when a small line scanner recognizes one, otherwise fixed line windows. Each chunk is embedded with `local-hash-v1`, a 256-dimension feature hash in this process. Vectors are stored with pgvector. No hosted embedding model is called. The SQL check constraint records that model name so a later provider cannot be written into the same column by accident.

Search loads the nearest stored vectors for that owner and reranks them with token overlap and symbol name. Scores in the response are those measurements. Repository text is not sent to a language model.

## Consequences

Semantic search follows shared tokens. It is not a hosted embedding model. Replacing it means a new model id, a migration that drops the current check, and a reindex.

The worker must be running, and it must see the same clone directory as the API. Compose mounts one volume for both. A missing clone becomes indexing status `failed` with a fixed message. Git's own output is still not returned.

Caps stop a huge repository at 2,000 files and 4,000 chunks. The repository is then `completed` with `indexTruncated` set.
