const LOGIN_ERRORS: Record<string, string> = {
  github_not_configured:
    'GitHub sign-in is not configured. Set the GitHub OAuth app values and an encryption key on the API.',
  access_denied: 'GitHub sign-in was cancelled.',
  oauth_failed: 'GitHub sign-in did not complete. Try again.',
  session_unavailable: 'Sign-in could not be started. Try again shortly.',
};

export function loginErrorMessage(code: unknown): string | null {
  if (typeof code !== 'string') {
    return null;
  }
  return LOGIN_ERRORS[code] ?? null;
}
