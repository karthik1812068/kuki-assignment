'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { isResourceId } from '@/lib/resource-id';
import { parseTaskSummary } from '@/lib/parse-task';

export async function createTask(formData: FormData): Promise<void> {
  const repositoryId = formData.get('repositoryId');
  const title = formData.get('title');
  const description = formData.get('description');
  const mode = formData.get('mode');
  if (typeof repositoryId !== 'string' || !isResourceId(repositoryId)) {
    redirect('/repositories?error=task_failed');
  }
  if (typeof title !== 'string' || typeof description !== 'string' || typeof mode !== 'string') {
    redirect(`/repositories/${repositoryId}?error=task_failed`);
  }
  const response = await apiFetch('/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repositoryId, title, description, mode }),
  });
  if (!response?.ok) {
    redirect(`/repositories/${repositoryId}?error=task_failed`);
  }
  const task = parseTaskSummary(await response.json());
  if (!task) {
    redirect(`/repositories/${repositoryId}?error=task_failed`);
  }
  redirect(`/tasks/${task.id}`);
}

export async function decideTask(formData: FormData): Promise<void> {
  const id = formData.get('id');
  const decision = formData.get('decision');
  if (typeof id !== 'string' || !isResourceId(id)) {
    redirect('/tasks?error=decision_failed');
  }
  if (decision !== 'approve' && decision !== 'reject' && decision !== 'cancel') {
    redirect(`/tasks/${id}?error=decision_failed`);
  }
  const response = await apiFetch(`/tasks/${id}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  if (!response?.ok) {
    redirect(`/tasks/${id}?error=decision_failed`);
  }
  redirect(`/tasks/${id}`);
}
