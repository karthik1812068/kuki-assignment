'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export async function uploadDocuments(formData: FormData): Promise<void> {
  const files = formData.getAll('files');
  if (files.length === 0) {
    redirect('/documents?error=upload_failed');
  }
  const body = new FormData();
  for (const file of files) {
    if (file instanceof File && file.size > 0) {
      body.append('files', file, file.name);
    }
  }
  if (![...body.keys()].includes('files')) {
    redirect('/documents?error=upload_failed');
  }
  const response = await apiFetch('/documents', { method: 'POST', body });
  if (!response?.ok) {
    redirect('/documents?error=upload_failed');
  }
  redirect('/documents');
}
