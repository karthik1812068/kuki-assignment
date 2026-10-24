import type { Metadata } from 'next';
import { EvaluationBoard } from './evaluation-board';

export const metadata: Metadata = { title: 'Evaluation' };

export default function EvaluationPage() {
  return (
    <main className="mx-auto w-full max-w-5xl">
      <EvaluationBoard />
    </main>
  );
}
