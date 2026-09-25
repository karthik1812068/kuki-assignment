import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">404</p>
      <h1 className="mt-3 text-3xl font-semibold">That page is not available.</h1>
      <Link href="/dashboard" className="mt-6 text-sm text-accent">
        Back to the dashboard
      </Link>
    </main>
  );
}
