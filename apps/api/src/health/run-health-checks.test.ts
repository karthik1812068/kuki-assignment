import { describe, expect, it } from 'vitest';
import { runHealthChecks } from './run-health-checks';

describe('runHealthChecks', () => {
  it('reports ok when every dependency responds', async () => {
    const report = await runHealthChecks('api', {
      database: () => Promise.resolve(),
      redis: () => Promise.resolve(),
    });

    expect(report.status).toBe('ok');
    expect(report.checks.database?.status).toBe('up');
    expect(report.checks.redis?.status).toBe('up');
    expect(report.checks.database?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports degraded without leaking the underlying error', async () => {
    const report = await runHealthChecks('api', {
      database: () => Promise.reject(new Error('password=super-secret-db')),
      redis: () => Promise.resolve(),
    });

    expect(report.status).toBe('degraded');
    expect(report.checks.database?.status).toBe('down');
    expect(report.checks.redis?.status).toBe('up');
    expect(JSON.stringify(report)).not.toContain('super-secret-db');
  });
});
