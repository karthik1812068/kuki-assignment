import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { extractDocument, type DocumentExtraction } from '../extract-document';
import { answerQuestion } from './answer';
import { EVAL_CASES, type EvalCase } from './cases';
import type { GroundedAnswer } from './types';

export type { EvalCase };

export interface CaseScore {
  id: string;
  question: string;
  notes: string;
  baseline: GroundedAnswer;
  improved: GroundedAnswer;
  baselinePass: boolean;
  improvedPass: boolean;
  baselineScore: number;
  improvedScore: number;
  delta: number;
}

export interface EvalReport {
  command: string;
  cases: number;
  baselinePassed: number;
  improvedPassed: number;
  baselinePassRate: number;
  improvedPassRate: number;
  baselineAvg: number;
  improvedAvg: number;
  weakness: string;
  improvement: string;
  unresolved: string;
  details: CaseScore[];
}

const PASS = 0.7;

export function loadFixtureDocuments(root = process.cwd()): DocumentExtraction[] {
  const directory = path.join(root, 'docs', 'evaluation', 'fixtures');
  return readdirSync(directory)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => extractDocument(name, readFileSync(path.join(directory, name))));
}

export function barRaiserReport(root = process.cwd()): EvalReport {
  const documents = loadFixtureDocuments(root);
  const details = EVAL_CASES.map((item) => {
    const baseline = answerQuestion(item.question, documents, 'baseline');
    const improved = answerQuestion(item.question, documents, 'improved');
    const baselineScore = grade(item, baseline);
    const improvedScore = grade(item, improved);
    return {
      id: item.id,
      question: item.question,
      notes: item.notes,
      baseline,
      improved,
      baselineScore,
      improvedScore,
      delta: round4(improvedScore - baselineScore),
      baselinePass: baselineScore >= PASS,
      improvedPass: improvedScore >= PASS,
    };
  });
  const baselinePassed = details.filter((item) => item.baselinePass).length;
  const improvedPassed = details.filter((item) => item.improvedPass).length;
  return {
    command: 'npm test',
    cases: details.length,
    baselinePassed,
    improvedPassed,
    baselinePassRate: round4(baselinePassed / details.length),
    improvedPassRate: round4(improvedPassed / details.length),
    baselineAvg: average(details.map((item) => item.baselineScore)),
    improvedAvg: average(details.map((item) => item.improvedScore)),
    weakness:
      'Baseline takes the first non-zero number it sees, so it mixes bill line items and never flags missing or conflicting values.',
    improvement:
      'The better path splits amount roles, keeps FY 2024-25 vs 2025-26 separate, checks Form 37 dates and company names, and refuses diesel/gas when they are not in the files.',
    unresolved:
      'PDF and native .xls locators are still weaker than CSV. Upload your own files on Documents if you need answers from those.',
    details,
  };
}

export function compactBarRaiser(report: EvalReport) {
  return {
    command: report.command,
    cases: report.cases,
    baselinePassed: report.baselinePassed,
    improvedPassed: report.improvedPassed,
    baselinePassRate: report.baselinePassRate,
    improvedPassRate: report.improvedPassRate,
    baselineAvg: report.baselineAvg,
    improvedAvg: report.improvedAvg,
    weakness: report.weakness,
    improvement: report.improvement,
    unresolved: report.unresolved,
    details: report.details.map((item) => ({
      id: item.id,
      question: item.question,
      notes: item.notes,
      baselinePass: item.baselinePass,
      improvedPass: item.improvedPass,
      baselineScore: item.baselineScore,
      improvedScore: item.improvedScore,
      delta: item.delta,
    })),
  };
}

function grade(item: EvalCase, answer: GroundedAnswer): number {
  const haystack = answer.answer.toLowerCase();
  const hits = item.expectedAnswerIncludes.filter((part) =>
    haystack.includes(part.toLowerCase()),
  ).length;
  const answerScore =
    item.expectedAnswerIncludes.length === 0 ? 1 : hits / item.expectedAnswerIncludes.length;
  const files = new Set(answer.evidence.map((entry) => entry.filename));
  const fileScore =
    item.expectedFiles.length === 0
      ? answer.evidence.length === 0
        ? 1
        : 0.5
      : item.expectedFiles.filter((name) => files.has(name)).length / item.expectedFiles.length;
  const flagScore =
    (answer.calculated === item.calculated ? 1 : 0) * 0.34 +
    (answer.missing === item.missing ? 1 : 0) * 0.33 +
    (answer.conflict === item.conflict ? 1 : 0) * 0.33;
  return round4(0.5 * answerScore + 0.3 * fileScore + 0.2 * flagScore);
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return round4(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
