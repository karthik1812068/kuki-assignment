import { describe, expect, it } from 'vitest';
import { createSessionId, isSessionId } from './session-id';

describe('createSessionId', () => {
  it('creates an unguessable id and rejects short values', () => {
    const id = createSessionId();
    expect(isSessionId(id)).toBe(true);
    expect(isSessionId('short')).toBe(false);
    expect(createSessionId()).not.toBe(id);
  });
});
