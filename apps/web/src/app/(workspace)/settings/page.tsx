import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/current-user';
import { apiFetch } from '@/lib/api';
import { publicApiUrl } from '@/lib/api-url';
import { parseAgentStatus } from '@/lib/parse-agent';

export const metadata: Metadata = { title: 'Settings' };

const variables = [
  ['DATABASE_URL', 'Required now'],
  ['REDIS_URL', 'Required now'],
  ['API_PORT', 'Required now'],
  ['WEB_ORIGIN', 'Required now'],
  ['NEXT_PUBLIC_API_URL', 'Required for the browser'],
  ['GITHUB_CLIENT_ID', 'Required for sign-in'],
  ['GITHUB_CLIENT_SECRET', 'Required for sign-in'],
  ['GITHUB_CALLBACK_URL', 'Required for sign-in'],
  ['LLM_API_KEY', 'Required before a model call'],
  ['LLM_MODEL', 'Required before a model call'],
  ['LLM_BASE_URL', 'Optional. Defaults to the OpenAI API root'],
  ['JWT_SECRET', 'Reserved'],
  ['ENCRYPTION_KEY', 'Required for sign-in'],
] as const;

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const agentResponse = await apiFetch('/agent');
  const agentBody: unknown = agentResponse?.ok ? await agentResponse.json() : null;
  const agent = agentResponse?.ok ? parseAgentStatus(agentBody) : null;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Environment</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Values stay on the server. This page lists names only. The browser talks to{' '}
          <span className="font-mono text-ink">{publicApiUrl()}</span>.
        </p>
      </header>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
        {variables.map(([name, state]) => (
          <li key={name} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span className="font-mono">{name}</span>
            <span className="text-muted">{state}</span>
          </li>
        ))}
      </ul>
      <section className="rounded-xl border border-line bg-panel p-5">
        <h2 className="text-lg font-medium">Language model</h2>
        {agent === null ? (
          <p className="mt-2 text-sm leading-6 text-muted">Model status could not be loaded.</p>
        ) : agent.provider === null ? (
          <p className="mt-2 text-sm leading-6 text-muted">
            No language model is configured. Set LLM_API_KEY and LLM_MODEL on the API. Tool handlers
            are installed, and writes still wait for approval. {agent.toolCount} tools are defined.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted">
            Provider {agent.provider}, model {agent.model}. Writes, tests, and publishing wait for
            approval. {agent.toolCount} tools are defined.
          </p>
        )}
      </section>
      <section className="rounded-xl border border-line bg-panel p-5">
        <h2 className="text-lg font-medium">GitHub permissions</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          These are the OAuth scopes stored for {user?.login ?? 'this session'}.
        </p>
        {user && user.scopes.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {user.scopes.map((scope) => (
              <li
                key={scope}
                className="rounded-md border border-line px-2 py-1 font-mono text-xs text-ink"
              >
                {scope}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">No GitHub scopes are stored for this session.</p>
        )}
      </section>
    </main>
  );
}
