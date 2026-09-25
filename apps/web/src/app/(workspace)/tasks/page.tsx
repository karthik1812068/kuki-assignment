import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { apiFetch } from '@/lib/api';
import { parseTaskList } from '@/lib/parse-task';

export const metadata: Metadata = { title: 'Tasks' };

export default async function TasksPage() {
  const response = await apiFetch('/tasks');
  const tasks = response?.ok ? parseTaskList(await response.json()) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Tasks</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Engineering tasks</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          A task inspects the repository, writes a plan, and waits for approval before it edits
          code, runs the sandbox, or opens a pull request.
        </p>
      </header>
      {tasks === null ? (
        <EmptyState title="Tasks could not be loaded" body="The API did not return a task list." />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks have been created"
          body="Open a cloned repository and describe the change you want."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/tasks/${task.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-medium">{task.title}</span>
                  <span className="mt-1 block font-mono text-xs text-muted">{task.mode}</span>
                </span>
                <span className="text-muted">{task.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
