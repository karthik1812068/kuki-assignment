import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/empty-state';
import { TaskRefresh } from '@/components/task-refresh';
import { apiFetch } from '@/lib/api';
import { parseDocument } from '@/lib/parse-document';
import { isResourceId } from '@/lib/resource-id';

export const metadata: Metadata = { title: 'Document' };

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isResourceId(id)) {
    notFound();
  }
  const response = await apiFetch(`/documents/${id}`);
  const document = response?.ok ? parseDocument(await response.json()) : null;
  if (!document) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <EmptyState
          title="Document could not be loaded"
          body="It may belong to another account, or processing has not saved a result yet."
        />
      </main>
    );
  }
  const active = document.status === 'queued' || document.status === 'processing';
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <TaskRefresh active={active} />
      <p className="font-mono text-xs text-muted">
        <Link href="/documents" className="text-accent">
          Documents
        </Link>
      </p>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{document.filename}</h1>
        <p className="mt-2 text-sm text-muted">
          {document.kind} · {document.status}
          {document.financialYears.length > 0 ? ` · ${document.financialYears.join(', ')}` : ''}
        </p>
        {document.error ? <p className="mt-2 text-sm text-danger">{document.error}</p> : null}
      </header>
      {document.facts.length === 0 ? (
        <EmptyState
          title={active ? 'Processing this file' : 'No extracted facts yet'}
          body={
            active
              ? 'This page refreshes while the worker reads the file. Status is kept after restart.'
              : 'Open a completed document to see values and the sheet or line they came from.'
          }
        />
      ) : (
        <table className="w-full overflow-hidden rounded-xl border border-line bg-panel text-sm">
          <thead className="bg-panel-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Label</th>
              <th className="px-4 py-2 font-medium">Value</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Kind</th>
            </tr>
          </thead>
          <tbody>
            {document.facts.map((fact, index) => (
              <tr key={`${fact.label}-${index}`} className="border-t border-line">
                <td className="px-4 py-2">{fact.label}</td>
                <td className="px-4 py-2">{fact.value}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{fact.source.locator}</td>
                <td className="px-4 py-2 text-muted">
                  {fact.calculated ? 'calculated' : 'from document'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
