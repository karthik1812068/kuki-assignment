import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/empty-state';
import { TaskRefresh } from '@/components/task-refresh';
import { apiFetch } from '@/lib/api';
import { parseTaskDetail } from '@/lib/parse-task';
import { isResourceId } from '@/lib/resource-id';
import { decideTask } from '../actions';

export const metadata: Metadata = { title: 'Task' };

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!isResourceId(id)) {
    notFound();
  }
  const response = await apiFetch(`/tasks/${id}`);
  if (response?.status === 404) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Task</h1>
        <EmptyState title="This task is not available" body="It is not stored for this account." />
      </main>
    );
  }
  const task = response?.ok ? parseTaskDetail(await response.json()) : null;
  if (!task) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Task</h1>
        <EmptyState
          title="Task details could not be loaded"
          body="The API did not return this task."
        />
      </main>
    );
  }
  const waiting = task.status === 'WAITING_FOR_APPROVAL';
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <TaskRefresh active={!TERMINAL.has(task.status)} />
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Task</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{task.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{task.description}</p>
      </header>
      {query.error === 'decision_failed' ? (
        <p className="rounded-md border border-line px-3 py-2 text-sm text-warn">
          That decision could not be saved.
        </p>
      ) : null}
      {task.error ? (
        <p className="rounded-md border border-line px-3 py-2 text-sm">{task.error}</p>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <Fact label="Status" value={task.status} />
        <Fact label="Outcome" value={task.outcome ?? 'In progress'} />
        <Fact label="Gate" value={task.pendingGate ?? 'None'} />
      </section>
      {waiting ? (
        <form action={decideTask} className="flex flex-wrap gap-3">
          <input type="hidden" name="id" value={task.id} />
          <button
            name="decision"
            value="approve"
            className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink"
          >
            {task.pendingGate === 'git' ? 'Approve commit and pull request' : 'Approve plan'}
          </button>
          <button
            name="decision"
            value="reject"
            className="rounded-md border border-line px-3 py-2 text-sm"
          >
            Reject
          </button>
          <button
            name="decision"
            value="cancel"
            className="rounded-md border border-line px-3 py-2 text-sm"
          >
            Cancel
          </button>
        </form>
      ) : null}
      <section className="rounded-xl border border-line bg-panel p-5">
        <h2 className="text-lg font-medium">Plan</h2>
        {task.plan ? (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
            {task.plan.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted">The plan is not ready yet.</p>
        )}
        {task.plan?.source ? (
          <p className="mt-3 font-mono text-xs text-muted">Source: {task.plan.source}</p>
        ) : null}
      </section>
      <section className="rounded-xl border border-line bg-panel p-5">
        <h2 className="text-lg font-medium">Diff</h2>
        {task.changes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No file has been changed.</p>
        ) : (
          task.changes.map((change) => (
            <article key={`${change.path}-${change.reason}`} className="mt-4">
              <h3 className="font-mono text-sm">{change.path}</h3>
              <p className="mt-1 text-sm text-muted">{change.reason}</p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-ink/5 p-3 text-xs leading-5">
                {change.diff}
              </pre>
            </article>
          ))
        )}
      </section>
      <section className="rounded-xl border border-line bg-panel p-5">
        <h2 className="text-lg font-medium">Sandbox</h2>
        {task.tests.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No sandbox command has run.</p>
        ) : (
          task.tests.map((test, index) => (
            <article key={`${test.command}-${index}`} className="mt-3 text-sm">
              <p>
                {test.command} · {test.status}
                {test.durationMs !== null ? ` · ${test.durationMs} ms` : ''}
              </p>
              {test.stderr ? (
                <pre className="mt-2 overflow-x-auto text-xs text-muted">{test.stderr}</pre>
              ) : null}
            </article>
          ))
        )}
      </section>
      <section className="rounded-xl border border-line bg-panel p-5">
        <h2 className="text-lg font-medium">Review</h2>
        {task.findings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No finding has been recorded.</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {task.findings.map((finding) => (
              <li key={`${finding.path}-${finding.line}-${finding.problem}`}>
                <span className="font-mono text-xs">{finding.severity}</span> {finding.problem} ·{' '}
                {finding.path}
                {finding.line ? `:${finding.line}` : ''}
                <span className="mt-1 block text-muted">{finding.recommendation}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl border border-line bg-panel p-5">
        <h2 className="text-lg font-medium">Pull request</h2>
        {task.pullRequest?.url ? (
          <a href={task.pullRequest.url} className="mt-2 inline-block text-sm text-accent">
            {task.pullRequest.title}
          </a>
        ) : (
          <p className="mt-2 text-sm text-muted">No pull request has been opened.</p>
        )}
        <p className="mt-4 text-sm text-muted">
          Tokens in {task.usage.inputTokens}, out {task.usage.outputTokens}, calls{' '}
          {task.usage.callCount}.
          {task.usage.estimatedCostUsd === null
            ? ' Cost is not shown until both token prices are configured.'
            : ` Estimated cost $${task.usage.estimatedCostUsd}.`}
        </p>
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 text-sm">{value}</p>
    </article>
  );
}
