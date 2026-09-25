# Health API

The API exposes process and dependency checks. Authentication is documented in [auth.md](auth.md). Repository routes are not implemented.

## `GET /health`

Liveness. Returns 200 when the process is running. It does not check Postgres or Redis.

```json
{ "status": "ok", "service": "api" }
```

## `GET /ready`

Readiness. Returns 200 when Postgres and Redis both respond, and 503 otherwise. The body is a measured report. Dependency errors are logged on the server and are not copied into the response.

```json
{
  "status": "ok",
  "service": "api",
  "checks": {
    "database": { "status": "up", "latencyMs": 4 },
    "redis": { "status": "up", "latencyMs": 2 }
  }
}
```

`latencyMs` is the time the check took in that request. It is not a stored metric.

Unexpected failures use:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "The request could not be completed.",
    "requestId": "..."
  }
}
```
