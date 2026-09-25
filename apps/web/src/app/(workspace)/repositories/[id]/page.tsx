import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ImportedRepository } from '@codepilot/types';
import { EmptyState } from '@/components/empty-state';
import { apiFetch } from '@/lib/api';
import { parseCodeSearch, parseImportedRepository } from '@/lib/parse-repository';
import { isResourceId } from '@/lib/resource-id';
import { createTask } from '../../tasks/actions';
import { importRepository, startIndexing } from '../actions';

export const metadata: Metadata = { title: 'Repository' };

const ERRORS: Record<string, string> = {
  clone_required: 'Clone the repository before indexing it.',
  index_failed: 'Indexing could not be started.',
  task_failed: 'The task could not be created.',
};

export default async function RepositoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!isResourceId(id)) {
    notFound();
  }

  const response = await apiFetch(`/repositories/${id}`);
  if (response?.status === 404) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Repository</h1>
        <EmptyState
          title="This repository is not loaded"
          body="It is not imported for this account."
        />
      </main>
    );
  }

  const body: unknown = response?.ok ? await response.json() : null;
  const repository = response?.ok ? parseImportedRepository(body) : null;
  if (!repository) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Repository</h1>
        <EmptyState
          title="Repository details could not be loaded"
          body="The API did not return this repository."
        />
      </main>
    );
  }

  const error = typeof query.error === 'string' ? (ERRORS[query.error] ?? null) : null;
  const searchText = typeof query.q === 'string' ? query.q.trim() : '';
  const search =
    searchText.length > 0 && searchText.length <= 200 ? await loadSearch(id, searchText) : null;
  const facts = [
    ['Visibility', repository.private ? 'Private' : 'Public'],
    ['Permission', repository.permission],
    ['Default branch', repository.defaultBranch],
    ['Language', repository.language ?? 'Not reported'],
    ['Clone', repository.status],
    ['Indexing', indexingLabel(repository.indexing)],
    ['Indexed files', countLabel(repository.fileCount)],
    ['Chunks', countLabel(repository.chunkCount)],
    ['Embedding', repository.embeddingModel ? 'Local hash' : 'Not created'],
  ] as const;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Repository</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{repository.name}</h1>
        <p className="mt-2 text-sm text-muted">{repository.fullName}</p>
        {repository.description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{repository.description}</p>
        ) : null}
        <a href={repository.htmlUrl} className="mt-3 inline-block text-sm text-accent">
          View on GitHub
        </a>
      </header>
      {error ? <Notice>{error}</Notice> : null}
      {repository.cloneError ? <Notice>{repository.cloneError}</Notice> : null}
      {repository.indexingError ? <Notice>{repository.indexingError}</Notice> : null}
      {repository.indexTruncated ? (
        <Notice>Indexing stopped at the file or chunk limit.</Notice>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {repository.status !== 'cloned' ? (
          <form action={importRepository}>
            <input type="hidden" name="fullName" value={repository.fullName} />
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink"
            >
              Clone again
            </button>
          </form>
        ) : null}
        <form action={startIndexing}>
          <input type="hidden" name="id" value={repository.id} />
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink"
          >
            {repository.indexing === 'not_started' ? 'Index repository' : 'Index again'}
          </button>
        </form>
        <p className="text-sm text-muted">Refresh this page to see queue progress.</p>
      </div>
      {repository.status === 'cloned' ? (
        <form
          action={createTask}
          className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-5"
        >
          <h2 className="text-lg font-medium">New task</h2>
          <input type="hidden" name="repositoryId" value={repository.id} />
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Short title"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            required
            maxLength={4000}
            placeholder="What should change? For an issue, include #123."
            className="min-h-28 rounded-md border border-line bg-panel px-3 py-2 text-sm"
          />
          <select
            name="mode"
            defaultValue="implement"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm"
          >
            <option value="implement">Implement</option>
            <option value="review">Review</option>
            <option value="security">Security review</option>
            <option value="docs">Documentation</option>
            <option value="issue">Issue to pull request</option>
          </select>
          <button
            type="submit"
            className="w-fit rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink"
          >
            Create task
          </button>
        </form>
      ) : null}
      <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right font-mono text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <Detected title="Languages" values={repository.detectedLanguages} />
      <Detected title="Frameworks" values={repository.detectedFrameworks} />
      <Detected title="Package managers" values={repository.detectedPackageManagers} />
      <Detected title="Test frameworks" values={repository.detectedTestFrameworks} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Search</h2>
        <form action={`/repositories/${repository.id}`} className="flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={searchText}
            maxLength={200}
            placeholder="Function, type, or phrase"
            className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            className="rounded-md border border-line px-3 py-2 text-sm text-ink"
          >
            Search
          </button>
        </form>
        {searchText.length === 0 ? (
          <p className="text-sm text-muted">
            Search uses the local index for this repository. It does not send the repository to a
            model.
          </p>
        ) : search === null ? (
          <EmptyState title="Search could not be loaded" body="The API did not return results." />
        ) : search.indexing !== 'completed' ? (
          <EmptyState
            title="Search is waiting for an index"
            body={`Indexing is ${indexingLabel(search.indexing).toLowerCase()}.`}
          />
        ) : search.hits.length === 0 ? (
          <EmptyState title="No matching chunks" body="Nothing in the index matched that query." />
        ) : (
          <ul className="flex flex-col gap-3">
            {search.hits.map((hit) => (
              <li
                key={`${hit.path}:${hit.startLine}:${hit.endLine}:${hit.symbol ?? ''}`}
                className="rounded-xl border border-line bg-panel p-4"
              >
                <p className="break-all font-mono text-sm text-ink">
                  {hit.path}:{hit.startLine}-{hit.endLine}
                </p>
                {hit.symbol ? <p className="mt-1 text-sm text-muted">{hit.symbol}</p> : null}
                <p className="mt-2 font-mono text-xs text-muted">
                  semantic {hit.semanticScore.toFixed(2)} · keyword {hit.keywordScore.toFixed(2)} ·
                  symbol {hit.symbolScore.toFixed(2)}
                </p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-ink">
                  {hit.excerpt}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Notice({ children }: { children: string }) {
  return (
    <p className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-warn" role="alert">
      {children}
    </p>
  );
}

function Detected({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) {
    return null;
  }
  return (
    <section>
      <h2 className="text-sm font-medium text-muted">{title}</h2>
      <p className="mt-1 text-sm text-ink">{values.join(', ')}</p>
    </section>
  );
}

function indexingLabel(status: ImportedRepository['indexing']): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Not started';
  }
}

function countLabel(value: number | null): string {
  return value === null ? 'Not recorded' : String(value);
}

async function loadSearch(id: string, query: string) {
  const response = await apiFetch(`/repositories/${id}/search?q=${encodeURIComponent(query)}`);
  if (!response?.ok) {
    return null;
  }
  const body: unknown = await response.json();
  return parseCodeSearch(body);
}
