import type { Metadata } from 'next';
import Link from 'next/link';
import type { AvailableRepository, ImportedRepository } from '@codepilot/types';
import { EmptyState } from '@/components/empty-state';
import { apiFetch } from '@/lib/api';
import {
  parseAvailableRepository,
  parseImportedRepository,
  parseRepositoryList,
} from '@/lib/parse-repository';
import { importRepository } from './actions';

function importedStatus(
  imported: ImportedRepository[] | null,
  githubRepoId: string,
): ImportedRepository['status'] | null {
  return imported?.find((repository) => repository.githubRepoId === githubRepoId)?.status ?? null;
}

export const metadata: Metadata = { title: 'Repositories' };

const ERRORS: Record<string, string> = {
  import_failed: 'The repository could not be imported.',
};

export default async function RepositoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? (ERRORS[params.error] ?? null) : null;
  const importedResponse = await apiFetch('/repositories');
  const githubResponse = await apiFetch('/repositories/github');
  const importedBody: unknown = importedResponse?.ok ? await importedResponse.json() : null;
  const githubBody: unknown = githubResponse?.ok ? await githubResponse.json() : null;
  const imported = importedResponse?.ok
    ? parseRepositoryList(importedBody, parseImportedRepository)
    : null;
  const available = githubResponse?.ok
    ? parseRepositoryList(githubBody, parseAvailableRepository)
    : null;
  const importedIds = new Set((imported ?? []).map((repository) => repository.githubRepoId));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Repositories</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">GitHub repositories</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Import clones the default branch. Start indexing from the repository page. The worker
          reads the clone and does not call a language model.
        </p>
      </header>
      {error ? (
        <p
          className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-warn"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Imported</h2>
        {imported === null ? (
          <EmptyState
            title="Imported repositories could not be loaded"
            body="The API did not return a repository list."
          />
        ) : imported.length === 0 ? (
          <EmptyState
            title="No repositories imported"
            body="Choose a repository below. Nothing is cloned until you import it."
          />
        ) : (
          <RepositoryTable repositories={imported} />
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Available on GitHub</h2>
        {githubResponse?.status === 409 ? (
          <EmptyState
            title="GitHub is not connected"
            body="Sign in with GitHub before this account can list repositories."
          />
        ) : available === null ? (
          <EmptyState
            title="GitHub repositories could not be loaded"
            body="The list request did not succeed."
          />
        ) : available.length === 0 ? (
          <EmptyState
            title="No GitHub repositories returned"
            body="This account did not receive any repositories from GitHub."
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {available.map((repository) => (
              <li
                key={repository.githubRepoId}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <RepositorySummary repository={repository} />
                {importedStatus(imported, repository.githubRepoId) === 'cloned' ? (
                  <span className="text-sm text-muted">Imported</span>
                ) : (
                  <form action={importRepository}>
                    <input type="hidden" name="fullName" value={repository.fullName} />
                    <button
                      type="submit"
                      className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
                    >
                      {importedIds.has(repository.githubRepoId) ? 'Clone again' : 'Import'}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function RepositoryTable({ repositories }: { repositories: ImportedRepository[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
      {repositories.map((repository) => (
        <li key={repository.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <Link href={`/repositories/${repository.id}`} className="min-w-0 flex-1">
            <RepositorySummary repository={repository} />
          </Link>
          {repository.status === 'cloned' ? (
            <span className="font-mono text-xs text-muted">
              {repository.status} · {indexingLabel(repository.indexing)}
            </span>
          ) : (
            <form action={importRepository}>
              <input type="hidden" name="fullName" value={repository.fullName} />
              <button
                type="submit"
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
              >
                Clone again
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

function indexingLabel(status: ImportedRepository['indexing']): string {
  switch (status) {
    case 'queued':
      return 'index queued';
    case 'running':
      return 'indexing';
    case 'completed':
      return 'indexed';
    case 'failed':
      return 'index failed';
    default:
      return 'not indexed';
  }
}

function RepositorySummary({ repository }: { repository: AvailableRepository }) {
  return (
    <span>
      <span className="block text-sm text-ink">{repository.fullName}</span>
      <span className="mt-1 block text-xs text-muted">
        {repository.private ? 'Private' : 'Public'} · {repository.permission} ·{' '}
        {repository.defaultBranch}
      </span>
    </span>
  );
}
