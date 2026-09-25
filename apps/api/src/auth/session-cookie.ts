export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function sessionCookie(
  name: string,
  value: string,
  options: { maxAgeSeconds: number; secure: boolean; sameSite: 'Lax' | 'None' },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${options.sameSite}`,
    `Max-Age=${options.maxAgeSeconds}`,
  ];
  if (options.secure || options.sameSite === 'None') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function cookiePolicy(
  webOrigin: string,
  requestHostname: string,
): { secure: boolean; sameSite: 'Lax' | 'None' } {
  const web = new URL(webOrigin);
  const sameHost = web.hostname === requestHostname;
  if (!sameHost) {
    return { secure: true, sameSite: 'None' };
  }
  return { secure: web.protocol === 'https:', sameSite: 'Lax' };
}
