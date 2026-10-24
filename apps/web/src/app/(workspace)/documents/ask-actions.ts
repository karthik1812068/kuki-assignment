'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export async function askDocuments(formData: FormData): Promise<void> {
  const question = formData.get('question');
  if (typeof question !== 'string' || question.trim().length < 3) {
    redirect('/documents?error=ask_failed');
  }
  const response = await apiFetch('/documents/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: question.trim() }),
  });
  if (!response?.ok) {
    redirect('/documents?error=ask_failed');
  }
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object') {
    redirect('/documents?error=ask_failed');
  }
  const record = body as Record<string, unknown>;
  const answer = typeof record.answer === 'string' ? record.answer : '';
  const params = new URLSearchParams();
  params.set('q', question.trim().slice(0, 200));
  params.set('a', answer.slice(0, 400));
  redirect(`/documents?${params.toString()}`);
}
