'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { parseImportedRepository } from '@/lib/parse-repository';
import { isResourceId } from '@/lib/resource-id';

const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export async function importRepository(formData: FormData): Promise<void> {
  const fullName = formData.get('fullName');
  if (typeof fullName !== 'string' || !FULL_NAME.test(fullName)) {
    redirect('/repositories?error=import_failed');
  }

  const response = await apiFetch('/repositories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fullName }),
  });
  if (!response?.ok) {
    redirect('/repositories?error=import_failed');
  }

  const body: unknown = await response.json();
  const repository = parseImportedRepository(body);
  if (!repository) {
    redirect('/repositories?error=import_failed');
  }
  redirect(`/repositories/${repository.id}`);
}

export async function startIndexing(formData: FormData): Promise<void> {
  const id = formData.get('id');
  if (typeof id !== 'string' || !isResourceId(id)) {
    redirect('/repositories?error=index_failed');
  }

  const response = await apiFetch(`/repositories/${id}/index`, { method: 'POST' });
  if (response?.status === 409) {
    redirect(`/repositories/${id}?error=clone_required`);
  }
  if (!response?.ok) {
    redirect(`/repositories/${id}?error=index_failed`);
  }
  redirect(`/repositories/${id}`);
}
