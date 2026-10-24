import { SESSION_COOKIE_NAME, type CurrentUser } from '@codepilot/types';
import { cookies } from 'next/headers';
import { serverApiUrl } from './api-url';
import { parseCurrentUser } from './parse-current-user';

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!session) {
    return null;
  }

  try {
    const response = await fetch(new URL('/auth/me', serverApiUrl()), {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(session)}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    return parseCurrentUser(body);
  } catch {
    return null;
  }
}
