import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeAppPath } from '@codepilot/types';
import { getCurrentUser } from '@/lib/current-user';
import { loginErrorMessage } from '@/lib/login-error';
import { publicApiUrl } from '@/lib/api-url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const error = loginErrorMessage(params.error);
  const next = safeAppPath(params.next);
  const start = new URL('/auth/github', publicApiUrl());
  start.searchParams.set('next', next);

  return (
    <main className="home-grid flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-xl border border-line bg-panel p-8">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">CodePilot AI</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in with GitHub</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          GitHub OAuth opens the workspace. The access token stays on the server and is not sent to
          this page.
        </p>
        {error ? (
          <p
            className="mt-4 rounded-md border border-line bg-panel-2 px-3 py-2 text-sm text-warn"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <a
          href={start.toString()}
          className="mt-6 block w-full rounded-md bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-ink"
        >
          Continue with GitHub
        </a>
      </section>
    </main>
  );
}
