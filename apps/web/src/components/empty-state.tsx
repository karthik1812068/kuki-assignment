import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-dashed border-line bg-panel px-5 py-8">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{body}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
