import { SESSION_COOKIE_NAME } from '@codepilot/types';
import { cookies } from 'next/headers';
import { publicApiUrl } from './api-url';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!session) {
    return null;
  }

  const headers = new Headers(init.headers);
  headers.set('cookie', `${SESSION_COOKIE_NAME}=${encodeURIComponent(session)}`);

  try {
    return await fetch(new URL(path, publicApiUrl()), {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch {
    return null;
  }
}
