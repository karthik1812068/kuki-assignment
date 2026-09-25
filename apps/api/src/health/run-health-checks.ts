import type { HealthReport } from '@codepilot/types';

export async function runHealthChecks(
  service: string,
  checks: Record<string, () => Promise<void>>,
): Promise<HealthReport> {
  const names = Object.keys(checks);
  const entries = await Promise.all(
    names.map(async (name) => {
      const check = checks[name];
      const started = Date.now();
      if (!check) {
        return [name, { status: 'down' as const, latencyMs: 0 }] as const;
      }

      try {
        await check();
        return [name, { status: 'up' as const, latencyMs: Date.now() - started }] as const;
      } catch {
        return [name, { status: 'down' as const, latencyMs: Date.now() - started }] as const;
      }
    }),
  );

  const reportChecks: HealthReport['checks'] = {};
  for (const [name, check] of entries) {
    reportChecks[name] = check;
  }

  const status = entries.every(([, check]) => check.status === 'up') ? 'ok' : 'degraded';
  return { status, service, checks: reportChecks };
}
