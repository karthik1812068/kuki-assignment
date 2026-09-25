'use client';

import { useCallback, useEffect, useState } from 'react';

interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs: number;
}

interface ReadyResponse {
  status: 'ok' | 'degraded';
  service: string;
  checks: Record<string, DependencyCheck>;
}

type StatusState =
  | { kind: 'loading' }
  | { kind: 'unreachable' }
  | { kind: 'invalid' }
  | { kind: 'ready'; httpStatus: number; body: ReadyResponse };

function isCheck(value: unknown): value is DependencyCheck {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    (record.status === 'up' || record.status === 'down') &&
    typeof record.latencyMs === 'number' &&
    Number.isFinite(record.latencyMs)
  );
}

function isReadyResponse(value: unknown): value is ReadyResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.status !== 'ok' && record.status !== 'degraded') {
    return false;
  }
  if (typeof record.service !== 'string' || !record.checks || typeof record.checks !== 'object') {
    return false;
  }
  return Object.values(record.checks).every((check) => isCheck(check));
}

export function InfraStatus({ apiUrl }: { apiUrl: string }) {
  const [state, setState] = useState<StatusState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch(`${apiUrl}/ready`, { cache: 'no-store' });
      const body: unknown = await response.json();
      if (!isReadyResponse(body)) {
        setState({ kind: 'invalid' });
        return;
      }
      setState({ kind: 'ready', httpStatus: response.status, body });
    } catch {
      setState({ kind: 'unreachable' });
    }
  }, [apiUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Infrastructure</h2>
          <p className="mt-1 text-sm text-muted">Live readiness from {apiUrl}/ready.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="rounded-md border border-line px-3 py-1.5 text-sm text-ink"
        >
          Refresh
        </button>
      </div>
      <div className="mt-5">
        {state.kind === 'loading' ? <p className="text-sm text-muted">Checking the API…</p> : null}
        {state.kind === 'unreachable' ? (
          <p className="text-sm leading-6 text-warn">
            The API is not reachable. Start Postgres and Redis, then run the API from the repository
            root.
          </p>
        ) : null}
        {state.kind === 'invalid' ? (
          <p className="text-sm text-danger">The API returned an unexpected readiness payload.</p>
        ) : null}
        {state.kind === 'ready' ? (
          <ul className="space-y-3">
            {Object.entries(state.body.checks).map(([name, check]) => (
              <li key={name} className="flex items-center justify-between gap-4 text-sm">
                <span className="capitalize">{name}</span>
                <span className={check.status === 'up' ? 'text-ok' : 'text-danger'}>
                  {check.status} · {check.latencyMs} ms
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
