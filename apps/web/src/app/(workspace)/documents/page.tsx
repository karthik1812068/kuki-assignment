import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { TaskRefresh } from '@/components/task-refresh';
import { apiFetch } from '@/lib/api';
import { parseDocumentList } from '@/lib/parse-document';
import { uploadDocuments } from './actions';
import { askDocuments } from './ask-actions';

export const metadata: Metadata = { title: 'Documents' };

const ERRORS: Record<string, string> = {
  upload_failed: 'Those files could not be uploaded. Check the types and try again.',
  ask_failed: 'The question could not be answered. Upload completed documents first.',
};

const ACTIVE = new Set(['queued', 'processing']);

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; a?: string }>;
}) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? (ERRORS[params.error] ?? null) : null;
  const asked = typeof params.q === 'string' ? params.q : null;
  const answered = typeof params.a === 'string' ? params.a : null;
  const response = await apiFetch('/documents');
  const documents = response?.ok ? parseDocumentList(await response.json()) : null;
  const active = documents?.some((document) => ACTIVE.has(document.status)) ?? false;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <TaskRefresh active={active} />
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Documents</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Upload bills, workbooks, or notes. Each file is its own job, so one failure does not block
          the rest. Status is in Postgres, so it survives a restart.
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
      <form
        action={uploadDocuments}
        className="rounded-xl border border-line bg-panel p-5"
        encType="multipart/form-data"
      >
        <label className="text-sm font-medium" htmlFor="files">
          Files (pdf, xlsx, csv, txt, max 12)
        </label>
        <input
          id="files"
          name="files"
          type="file"
          multiple
          required
          accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.json"
          className="mt-3 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-panel-2 file:px-3 file:py-1.5 file:text-ink"
        />
        <button
          type="submit"
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
        >
          Upload and process
        </button>
      </form>
      <form action={askDocuments} className="rounded-xl border border-line bg-panel p-5">
        <label className="text-sm font-medium" htmlFor="question">
          Ask a question about the completed documents
        </label>
        <input
          id="question"
          name="question"
          type="text"
          required
          minLength={3}
          maxLength={400}
          placeholder="What electricity consumption is on the bill for FY 2023-24?"
          className="mt-3 w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          className="mt-4 rounded-md border border-line px-4 py-2 text-sm text-ink"
        >
          Ask
        </button>
        {asked && answered ? (
          <p className="mt-4 text-sm leading-6 text-muted">
            <span className="text-ink">{asked}</span>
            <span className="mt-2 block text-ink">{answered}</span>
          </p>
        ) : null}
      </form>
      {documents === null ? (
        <EmptyState
          title="Documents could not be loaded"
          body="The API did not return a document list. Sign in and confirm the API is running."
        />
      ) : documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          body="Nothing uploaded yet. Use the form above; rows show up as queued, then processing, then completed or failed."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {documents.map((document) => (
            <li key={document.id}>
              <Link
                href={`/documents/${document.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-medium">{document.filename}</span>
                  <span className="mt-1 block font-mono text-xs text-muted">
                    {document.kind}
                    {document.financialYears.length > 0
                      ? ` · ${document.financialYears.join(', ')}`
                      : ''}
                    {document.duplicateOf ? ' · duplicate of an earlier upload' : ''}
                  </span>
                </span>
                <StatusBadge status={document.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'completed'
      ? 'text-ok'
      : status === 'failed'
        ? 'text-danger'
        : status === 'processing' || status === 'queued'
          ? 'text-warn'
          : 'text-muted';
  return <span className={`font-mono text-xs uppercase ${color}`}>{status}</span>;
}
