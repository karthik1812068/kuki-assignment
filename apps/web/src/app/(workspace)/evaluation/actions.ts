'use server';

import { apiFetch } from '@/lib/api';
import type { EvaluationReport } from './types';

export async function loadEvaluationReport(): Promise<EvaluationReport | null> {
  const response = await apiFetch('/evaluation');
  if (!response?.ok) {
    return null;
  }
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object') {
    return null;
  }
  const record = body as EvaluationReport;
  if (!Array.isArray(record.details) || typeof record.cases !== 'number') {
    return null;
  }
  return record;
}
