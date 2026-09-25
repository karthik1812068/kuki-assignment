import { describe, expect, it } from 'vitest';
import { parseIndexJob } from './index-queue';

describe('parseIndexJob', () => {
  it('accepts two resource ids and rejects anything else', () => {
    const job = parseIndexJob(
      JSON.stringify({
        repositoryId: '22222222-2222-4222-8222-222222222222',
        ownerId: '11111111-1111-4111-8111-111111111111',
        token: 'gho_secret',
      }),
    );
    expect(job).toEqual({
      repositoryId: '22222222-2222-4222-8222-222222222222',
      ownerId: '11111111-1111-4111-8111-111111111111',
    });
    expect(
      parseIndexJob('{"repositoryId":"../etc","ownerId":"11111111-1111-4111-8111-111111111111"}'),
    ).toBeNull();
    expect(parseIndexJob('not-json')).toBeNull();
  });
});
