import { describe, expect, it } from 'vitest';
import { parseDocument } from './parse-document';

describe('parseDocument', () => {
  it('keeps public fields and drops a storage path', () => {
    const document = parseDocument({
      id: '22222222-2222-4222-8222-222222222222',
      filename: 'electricity-bill.csv',
      contentType: 'text/csv',
      byteSize: 120,
      kind: 'bill',
      status: 'completed',
      error: null,
      duplicateOf: null,
      financialYears: ['FY2024'],
      facts: [
        {
          label: 'amount',
          value: '1100',
          calculated: false,
          source: { locator: 'sheet row 3 column amount' },
        },
      ],
      excerpt: 'month,kwh',
      startedAt: null,
      completedAt: '2026-10-24T04:00:00.000Z',
      createdAt: '2026-10-24T04:00:00.000Z',
      storageKey: 'secret/path',
    });
    expect(document?.filename).toBe('electricity-bill.csv');
    expect(document?.financialYears).toEqual(['FY2024']);
    expect(document).not.toHaveProperty('storageKey');
  });
});
