import type { CurrentUser } from '@codepilot/types';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavLinks } from './nav-links';

export function WorkspaceShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-line bg-panel md:flex md:flex-col md:px-4 md:py-6">
        <Link href="/" className="px-3 font-mono text-sm text-accent">
          CodePilot AI
        </Link>
        <p className="mt-6 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Signed in
        </p>
        <p className="mt-1 truncate px-3 text-sm text-ink">{user.login}</p>
        <NavLinks className="mt-8 flex flex-col gap-1" />
      </aside>
      <div>
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-8">
          <NavLinks className="flex gap-1 overflow-x-auto md:hidden" />
          <p className="hidden font-mono text-xs text-muted md:block">{user.login}</p>
          <div className="ml-auto flex items-center gap-3">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-7 w-7 rounded-full"
              />
            ) : null}
            <span className="text-sm text-ink md:hidden">{user.login}</span>
            <form action="/auth/logout" method="post">
              <button type="submit" className="text-sm text-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <div className="px-4 py-8 md:px-8">{children}</div>
      </div>
    </div>
  );
}
