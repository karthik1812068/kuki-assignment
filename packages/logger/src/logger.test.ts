import { describe, expect, it } from 'vitest';
import { requestContext } from './context';
import { captureLogs, createLogger, errorMessage } from './logger';

describe('createLogger', () => {
  it('redacts secrets from structured logs', () => {
    const captured = captureLogs();
    const logger = createLogger('test', { destination: captured.destination });

    logger.info({ token: 'abc-secret', nested: { password: 'hunter2' } }, 'hello');

    const output = captured.read();
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('abc-secret');
    expect(output).not.toContain('hunter2');
    expect(output).toContain('"service":"test"');
  });

  it('adds the active request context', () => {
    const captured = captureLogs();
    const logger = createLogger('test', { destination: captured.destination });

    requestContext.run({ requestId: 'req-1', userId: 'user-1' }, () => {
      logger.info('inside');
    });

    const output = captured.read();
    expect(output).toContain('"requestId":"req-1"');
    expect(output).toContain('"userId":"user-1"');
  });
});

describe('errorMessage', () => {
  it('returns the error message or a generic fallback', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('nope')).toBe('Unknown error');
  });
});
