import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { WorkspaceShell } from '@/components/workspace-shell';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return <WorkspaceShell user={user}>{children}</WorkspaceShell>;
}
