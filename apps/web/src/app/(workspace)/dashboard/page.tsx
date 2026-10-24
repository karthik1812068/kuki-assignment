import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { InfraStatus } from '@/components/infra-status';
import { apiFetch } from '@/lib/api';
import { publicApiUrl } from '@/lib/api-url';
import { EVALUATION_RESULTS } from '@/lib/evaluation-results';
import { parseAgentStatus } from '@/lib/parse-agent';
import { parseMeasurements } from '@/lib/parse-task';
import { parseDocumentList } from '@/lib/parse-document';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Counts below come from this account and Redis. Eval numbers are from{' '}
          <span className="font-mono text-ink">{EVALUATION_RESULTS.command}</span> against the
          fixture files, not from guessed cloud usage.
        </p>
      </header>
      <InfraStatus apiUrl={publicApiUrl()} />
      <DashboardCounts />
    </main>
  );
}

async function DashboardCounts() {
  const [summaryResponse, agentResponse, documentResponse] = await Promise.all([
    apiFetch('/tasks/summary'),
    apiFetch('/agent'),
    apiFetch('/documents'),
  ]);
  const summary = summaryResponse?.ok ? parseMeasurements(await summaryResponse.json()) : null;
  const agent = agentResponse?.ok ? parseAgentStatus(await agentResponse.json()) : null;
  const documents = documentResponse?.ok ? parseDocumentList(await documentResponse.json()) : null;
  const work = agent?.work ?? null;
  const successRate =
    summary && summary.completed + summary.failed > 0
      ? Math.round((summary.completed / (summary.completed + summary.failed)) * 100)
      : null;
  return (
    <div className="grid gap-4">
      <section className="grid gap-4 lg:grid-cols-3">
        {work === null ? (
          <EmptyState
            title="Worker status could not be loaded"
            body="The API did not return queue counts. The worker heartbeat is stored in Redis."
          />
        ) : (
          <article className="rounded-xl border border-line bg-panel p-5">
            <h2 className="text-lg font-medium">Background processing</h2>
            <p className={`mt-2 text-sm ${work.workerLive ? 'text-ok' : 'text-warn'}`}>
              {work.workerLive ? 'Worker heartbeat is live.' : 'Worker heartbeat is missing.'}
            </p>
            <p className="mt-2 text-sm text-muted">
              Tasks waiting {work.task.waiting} · processing {work.task.processing} · dead{' '}
              {work.task.dead}
            </p>
            <p className="mt-2 text-sm text-muted">
              Documents waiting {work.documents.waiting} · processing {work.documents.processing} ·
              dead {work.documents.dead}
            </p>
            <p className="mt-2 text-sm text-muted">
              Index waiting {work.index.waiting} · processing {work.index.processing} · dead{' '}
              {work.index.dead}
            </p>
            <p className="mt-2 text-xs text-muted">
              Unfinished jobs are moved back to the queue when the worker starts. Failed jobs retry
              three times, then go to the dead list.
            </p>
          </article>
        )}
        {summary === null ? (
          <EmptyState
            title="Task counts could not be loaded"
            body="The API did not return measurements."
          />
        ) : (
          <article className="rounded-xl border border-line bg-panel p-5">
            <h2 className="text-lg font-medium">Task outcomes</h2>
            <p className="mt-2 text-sm text-muted">
              {summary.total} total · {summary.completed} completed · {summary.failed} failed ·{' '}
              {summary.cancelled} cancelled
            </p>
            <p className="mt-2 text-sm text-muted">
              {successRate === null
                ? 'Success rate needs at least one completed or failed task.'
                : `Completed share ${successRate}% of finished tasks.`}
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
        {documents === null ? (
          <EmptyState
            title="Documents could not be loaded"
            body="Sign in and open Documents to upload files."
          />
        ) : (
          <article className="rounded-xl border border-line bg-panel p-5">
            <h2 className="text-lg font-medium">Documents</h2>
            <p className="mt-2 text-sm text-muted">
              {documents.length} uploaded ·{' '}
              {documents.filter((item) => item.status === 'completed').length} completed ·{' '}
              {documents.filter((item) => item.status === 'failed').length} failed ·{' '}
              {documents.filter((item) => item.status === 'duplicate').length} duplicate
            </p>
            <p className="mt-2 text-sm text-muted">
              Each upload shows as queued, processing, completed, failed, or duplicate. That row is
              what survives a restart.
            </p>
          </article>
        )}
      </section>
      <article className="rounded-xl border border-line bg-panel p-5">
        <h2 className="text-lg font-medium">Evaluation</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Last fixture run: baseline {EVALUATION_RESULTS.baselinePassed}/{EVALUATION_RESULTS.cases},
          improved {EVALUATION_RESULTS.improvedPassed}/{EVALUATION_RESULTS.cases}. Re-run from the
          Evaluation page or{' '}
          <span className="font-mono text-ink">{EVALUATION_RESULTS.command}</span>.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-panel-2 px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.12em] text-muted">Baseline</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {percent(EVALUATION_RESULTS.baselineScore)}
            </dd>
          </div>
          <div className="rounded-lg bg-panel-2 px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.12em] text-muted">Current</dt>
            <dd className="mt-1 text-2xl font-semibold text-ok">
              {percent(EVALUATION_RESULTS.improvedScore)}
            </dd>
          </div>
        </dl>
      </article>
    </div>
  );
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
