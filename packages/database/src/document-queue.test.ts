import { describe, expect, it } from 'vitest';
import { parseDocumentJob } from './document-queue';

describe('parseDocumentJob', () => {
  it('accepts two resource ids and rejects anything else', () => {
    expect(
      parseDocumentJob(
        JSON.stringify({
          documentId: '22222222-2222-4222-8222-222222222222',
          ownerId: '11111111-1111-4111-8111-111111111111',
        }),
      ),
    ).toEqual({
      documentId: '22222222-2222-4222-8222-222222222222',
      ownerId: '11111111-1111-4111-8111-111111111111',
    });
    expect(
      parseDocumentJob('{"documentId":"../etc","ownerId":"11111111-1111-4111-8111-111111111111"}'),
    ).toBeNull();
  });
});
