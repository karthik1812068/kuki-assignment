import { describe, expect, it } from 'vitest';
import { safeAppPath, SESSION_COOKIE_NAME } from './index';

describe('safeAppPath', () => {
  it('allows workspace paths and drops everything else', () => {
    expect(safeAppPath('/tasks/123')).toBe('/tasks/123');
    expect(safeAppPath('/settings')).toBe('/settings');
    expect(safeAppPath('https://evil.example/tasks')).toBe('/dashboard');
    expect(safeAppPath('//evil.example')).toBe('/dashboard');
    expect(safeAppPath('/login')).toBe('/dashboard');
    expect(safeAppPath(undefined)).toBe('/dashboard');
  });
});

describe('SESSION_COOKIE_NAME', () => {
  it('is a fixed cookie name with no token material', () => {
    expect(SESSION_COOKIE_NAME).toBe('codepilot_session');
  });
});
