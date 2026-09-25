import { describe, expect, it } from 'vitest';
import { cookiePolicy, readCookie, sessionCookie } from './session-cookie';

describe('session cookies', () => {
  it('round-trips one named cookie and ignores the others', () => {
    const header = sessionCookie('codepilot_session', 'abc_DEF-123', {
      maxAgeSeconds: 60,
      secure: false,
      sameSite: 'Lax',
    });

    expect(header).toContain('HttpOnly');
    expect(header).not.toContain('Secure');
    expect(readCookie(`theme=dark; ${header}`, 'codepilot_session')).toBe('abc_DEF-123');
  });

  it('uses Lax on the same host and Secure on https', () => {
    expect(cookiePolicy('http://localhost:3000', 'localhost')).toEqual({
      secure: false,
      sameSite: 'Lax',
    });
    expect(cookiePolicy('https://app.example.com', 'app.example.com').secure).toBe(true);
    expect(cookiePolicy('https://app.example.com', 'api.example.com')).toEqual({
      secure: true,
      sameSite: 'None',
    });
  });
});
