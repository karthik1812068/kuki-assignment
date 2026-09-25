import Link from 'next/link';

const capabilities = [
  ['Repository map', 'Languages, frameworks, and searchable chunks from the local index.'],
  ['Implementation plan', 'A reviewable plan before any code is changed.'],
  ['Sandbox checks', 'Tests and builds run away from the application server.'],
  ['Human approval', 'Writes, commits, and pull requests wait for you.'],
] as const;

export default function HomePage() {
  return (
    <main className="home-grid min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <p className="font-mono text-sm text-accent">CodePilot AI</p>
        <Link
          href="/login"
          className="rounded-md border border-line px-3 py-2 text-sm text-muted hover:text-ink"
        >
          Sign in
        </Link>
      </header>
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-20 pt-10 lg:grid-cols-[1.3fr_0.7fr] lg:pt-16">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-accent">
            Foundation preview
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            An engineering workspace, not a chat box.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            CodePilot AI will read a repository, propose a plan, change code under approval, and
            show the diff. Sign in with GitHub to open the workspace. Indexing uses a local
            embedding. The agent can plan and change code after you approve it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
            >
              Open dashboard
            </Link>
            <Link
              href="/settings"
              className="rounded-md border border-line px-4 py-2.5 text-sm text-ink"
            >
              Environment
            </Link>
          </div>
        </div>
        <aside className="rounded-xl border border-line bg-panel/90 p-5">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">This build</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between gap-4">
              <span>API and worker</span>
              <span className="text-ok">Ready to run</span>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span>GitHub login</span>
              <span className="text-ok">OAuth</span>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span>Repository import</span>
              <span className="text-ok">Clone</span>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span>Repository indexing</span>
              <span className="text-ok">Local embeddings</span>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span>Language model</span>
              <span className="text-ok">Boundary</span>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span>Coding agent</span>
              <span className="text-ok">Approval gated</span>
            </li>
          </ul>
        </aside>
      </section>
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-16 sm:grid-cols-2">
        {capabilities.map(([title, body]) => (
          <article key={title} className="rounded-xl border border-line bg-panel p-5">
            <h2 className="text-lg font-medium">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
