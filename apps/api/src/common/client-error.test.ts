import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { clientError } from './client-error';

describe('clientError', () => {
  it('keeps a known error code and message', () => {
    const error = new HttpException(
      { code: 'UNAUTHENTICATED', message: 'Sign in is required.' },
      401,
    );
    expect(clientError(error)).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Sign in is required.',
    });
  });

  it('drops an unexpected code', () => {
    const error = new HttpException({ code: 'token gho_secret', message: 'no' }, 400);
    expect(clientError(error).code).toBe('REQUEST_ERROR');
  });
});
