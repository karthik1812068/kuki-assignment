import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { InfraStatus } from '@/components/infra-status';
import { apiFetch } from '@/lib/api';
import { publicApiUrl } from '@/lib/api-url';
import { parseMeasurements } from '@/lib/parse-task';
import { parseRepositoryList, parseImportedRepository } from '@/lib/parse-repository';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Workspace</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Counts below come from this account. Duration and cost stay blank until a finished task
          has those measurements.
        </p>
      </header>
      <InfraStatus apiUrl={publicApiUrl()} />
      <DashboardCounts />
    </main>
  );
}

async function DashboardCounts() {
  const [repoResponse, summaryResponse] = await Promise.all([
    apiFetch('/repositories'),
    apiFetch('/tasks/summary'),
  ]);
  const repositories = repoResponse?.ok
    ? parseRepositoryList(await repoResponse.json(), parseImportedRepository)
    : null;
  const summary = summaryResponse?.ok ? parseMeasurements(await summaryResponse.json()) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {repositories === null ? (
        <EmptyState
          title="Repositories could not be loaded"
          body="The API did not return a list."
        />
      ) : (
        <article className="rounded-xl border border-line bg-panel p-5">
          <h2 className="text-lg font-medium">Repositories</h2>
          <p className="mt-2 text-sm text-muted">{repositories.length} imported</p>
        </article>
      )}
      {summary === null ? (
        <EmptyState
          title="Task counts could not be loaded"
          body="The API did not return measurements."
        />
      ) : (
        <article className="rounded-xl border border-line bg-panel p-5">
          <h2 className="text-lg font-medium">Tasks</h2>
          <p className="mt-2 text-sm text-muted">
            {summary.total} total · {summary.completed} completed · {summary.failed} failed ·{' '}
            {summary.cancelled} cancelled
          </p>
          <p className="mt-2 text-sm text-muted">
            {summary.averageDurationMs === null
              ? 'Average duration is not available yet.'
              : `Average duration ${summary.averageDurationMs} ms.`}
          </p>
          <p className="mt-2 text-sm text-muted">
            Tokens in {summary.inputTokens}, out {summary.outputTokens}.{' '}
            {summary.estimatedCostUsd === null
              ? 'Cost is not shown until token prices are configured.'
              : `Estimated cost $${summary.estimatedCostUsd} from ${summary.costMeasuredRuns} priced runs.`}
          </p>
        </article>
      )}
    </div>
  );
}
