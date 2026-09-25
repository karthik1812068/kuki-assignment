# Authentication API

GitHub OAuth signs a user in. The browser receives an HttpOnly session cookie. The GitHub access token is encrypted and stored in Postgres. It is not returned by any endpoint and it is not written to the web app.

Sign-in requires `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, and `ENCRYPTION_KEY`. The callback URL must be the API address, for example `http://localhost:4000/auth/github/callback`.

The session cookie is host-only. The web app and the API need the same hostname so the browser sends the cookie to both. Ports may differ. `WEB_ORIGIN` should use `https` outside local development so the cookie is marked `Secure`.

## `GET /auth/github`

Starts the authorization-code flow with PKCE. Optional `next` is kept only when it is a workspace path (`/dashboard`, `/repositories`, `/tasks`, `/settings`).

The response is a redirect to GitHub. If OAuth is not configured, the response redirects to `{WEB_ORIGIN}/login?error=github_not_configured`.

Requested scopes: `read:user`, `user:email`, and `repo`.

## `GET /auth/github/callback`

GitHub redirects here with `code` and `state`. The API exchanges the code, stores the user and the encrypted token, creates a session, sets `codepilot_session`, and redirects to the web app.

The cookie is `HttpOnly`, `SameSite=Lax` when the web app and API share a hostname, and `Path=/`. It lasts 14 days.

Failures redirect to `/login` with `error` set to `access_denied`, `oauth_failed`, or `session_unavailable`. GitHub error text is not copied into the redirect.

## `POST /auth/logout`

Revokes the current session and clears the cookie. The response is `303` to `{WEB_ORIGIN}/login`.

## `GET /auth/me`

Requires the session cookie. `401` when the session is missing, revoked, or expired.

```json
{
  "id": "…",
  "githubId": "42",
  "login": "octocat",
  "name": "Octo",
  "email": "ada@example.com",
  "avatarUrl": "https://avatars.githubusercontent.com/u/42",
  "scopes": ["read:user", "user:email", "repo"]
}
```

`scopes` is the OAuth grant stored for the user. It is not a list of repository permissions. Repository listing is a later phase.

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Sign in is required.",
    "requestId": "…"
  }
}
```

## Authorization

Health checks and the OAuth start and callback routes are public. `/auth/me` and the workspace pages require a session. A session loads the user id from the database. The client does not choose that id.

There is no role table in this phase. Each user can use only their own session.
