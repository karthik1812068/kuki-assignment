'use client';

import { useState } from 'react';
import { loadEvaluationReport } from './actions';
import type { EvaluationReport } from './types';

export function EvaluationBoard() {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [baselineOn, setBaselineOn] = useState(false);
  const [improvedOn, setImprovedOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'baseline' | 'improved' | 'refresh') {
    setBusy(true);
    setError(null);
    const next = await loadEvaluationReport();
    setBusy(false);
    if (!next) {
      setError('The evaluation could not be run. Start the API and try again.');
      return;
    }
    setReport(next);
    if (kind === 'baseline') {
      setBaselineOn(true);
    } else if (kind === 'improved') {
      setImprovedOn(true);
    } else {
      setBaselineOn(true);
      setImprovedOn(true);
    }
  }

  return (
    <div className="eval-board rounded-2xl bg-[#f4efe6] px-5 py-8 text-[#3d2d22] md:px-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Evaluation</h1>
        <p className="mt-2 text-sm text-[#7a6a5c]">
          Twelve questions on the fixture files. Run baseline first, then improved.
        </p>
      </header>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('baseline')}
          className="rounded-full border border-[#d9cfc2] bg-white px-4 py-2 text-sm"
        >
          Run baseline
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('improved')}
          className="rounded-full bg-[#6b4a32] px-4 py-2 text-sm text-white"
        >
          Run improved
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('refresh')}
          className="rounded-full border border-[#d9cfc2] bg-white px-4 py-2 text-sm"
        >
          Refresh results
        </button>
      </div>
      {error ? (
        <p className="mt-4 text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <RateCard
          title="Baseline pass rate"
          ready={baselineOn}
          rate={report?.baselinePassRate ?? 0}
          passed={report?.baselinePassed ?? 0}
          total={report?.cases ?? 12}
          avg={report?.baselineAvg ?? 0}
        />
        <RateCard
          title="Improved pass rate"
          ready={improvedOn}
          rate={report?.improvedPassRate ?? 0}
          passed={report?.improvedPassed ?? 0}
          total={report?.cases ?? 12}
          avg={report?.improvedAvg ?? 0}
        />
      </section>
      <section className="mt-6 overflow-hidden rounded-xl border border-[#e6dccf] bg-white">
        <p className="bg-[#efe6d8] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[#7a6a5c]">
          Case-by-case
        </p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.08em] text-[#7a6a5c]">
            <tr>
              <th className="px-4 py-2 font-medium">Case</th>
              <th className="px-4 py-2 font-medium">Baseline</th>
              <th className="px-4 py-2 font-medium">Improved</th>
              <th className="px-4 py-2 font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {(report?.details ?? []).map((item) => (
              <tr key={item.id} className="border-t border-[#efe6d8] align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{item.id}</p>
                  <p className="mt-1 text-[#7a6a5c]">{item.question}</p>
                </td>
                <td className="px-4 py-3">
                  {baselineOn ? <Grade pass={item.baselinePass} score={item.baselineScore} /> : '—'}
                </td>
                <td className="px-4 py-3">
                  {improvedOn ? <Grade pass={item.improvedPass} score={item.improvedScore} /> : '—'}
                </td>
                <td className="px-4 py-3 text-[#7a6a5c]">
                  {baselineOn && improvedOn ? formatDelta(item.delta) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!report ? (
          <p className="px-4 py-6 text-sm text-[#7a6a5c]">
            Hit Run baseline, then Run improved. Cases use the CSVs under docs/evaluation/fixtures.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function RateCard({
  title,
  ready,
  rate,
  passed,
  total,
  avg,
}: {
  title: string;
  ready: boolean;
  rate: number;
  passed: number;
  total: number;
  avg: number;
}) {
  return (
    <article className="rounded-xl border border-[#e6dccf] bg-white px-5 py-4">
      <h2 className="text-sm text-[#7a6a5c]">{title}</h2>
      <p className="mt-2 text-4xl font-semibold">{ready ? `${Math.round(rate * 100)}%` : '—'}</p>
      <p className="mt-1 text-sm text-[#7a6a5c]">
        {ready ? `${passed}/${total} · avg ${avg}` : 'Not run yet'}
      </p>
    </article>
  );
}

function Grade({ pass, score }: { pass: boolean; score: number }) {
  return (
    <span className={pass ? 'text-[#1f7a4d]' : 'text-[#b42318]'}>
      {pass ? 'pass' : 'fail'} {trimScore(score)}
    </span>
  );
}

function trimScore(value: number): string {
  return String(Math.round(value * 10_000) / 10_000);
}

function formatDelta(value: number): string {
  if (value === 0) {
    return '0';
  }
  const shown = trimScore(value);
  return value > 0 ? `+${shown}` : shown;
}
