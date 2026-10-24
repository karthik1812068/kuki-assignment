import type { DocumentExtraction, ExtractedFact } from '../extract-document';
import { parseFinancialPeriod } from '../periods';
import type { Evidence, GroundedAnswer } from './types';

export interface LocatedFact extends ExtractedFact {
  filename: string;
  row: string;
  numeric: number | null;
}

export function collectFacts(documents: readonly DocumentExtraction[]): LocatedFact[] {
  const facts: LocatedFact[] = [];
  for (const document of documents) {
    for (const fact of document.facts) {
      facts.push({
        ...fact,
        filename: document.filename,
        row: rowKey(fact.source.locator),
        numeric: parseNumber(fact.value),
      });
    }
  }
  return facts;
}

export function onSameRow(
  facts: readonly LocatedFact[],
  fact: LocatedFact,
  value: string,
): boolean {
  return facts.some(
    (item) => item.filename === fact.filename && item.row === fact.row && item.value === value,
  );
}

export function rowHasPeriod(
  facts: readonly LocatedFact[],
  fact: LocatedFact,
  label: string,
): boolean {
  return facts.some((item) => {
    if (item.filename !== fact.filename || item.row !== fact.row) {
      return false;
    }
    return parseFinancialPeriod(item.value)?.label === label || item.value === label;
  });
}

export function sibling(
  facts: readonly LocatedFact[],
  fact: LocatedFact,
  label: string,
): LocatedFact | undefined {
  return facts.find(
    (item) => item.filename === fact.filename && item.row === fact.row && item.label === label,
  );
}

export function cite(fact: LocatedFact): Evidence {
  return { filename: fact.filename, locator: fact.source.locator, value: fact.value };
}

export function missing(answer: string): GroundedAnswer {
  return {
    answer,
    confidence: 'none',
    evidence: [],
    calculated: false,
    missing: true,
    conflict: false,
  };
}

export function ok(
  answer: string,
  evidence: Evidence[],
  extra: Partial<Pick<GroundedAnswer, 'calculated' | 'conflict' | 'confidence'>> = {},
): GroundedAnswer {
  return {
    answer,
    confidence: extra.confidence ?? 'high',
    evidence,
    calculated: extra.calculated ?? false,
    missing: false,
    conflict: extra.conflict ?? false,
  };
}

function rowKey(locator: string): string {
  const sheet = /sheet row (\d+)/u.exec(locator);
  if (sheet) {
    return `row:${sheet[1]}`;
  }
  const line = /line (\d+)/u.exec(locator);
  if (line) {
    return `line:${line[1]}`;
  }
  return locator;
}

function parseNumber(value: string): number | null {
  const match = /^[0-9]+(?:\.[0-9]+)?$/u.exec(value.replaceAll(',', ''));
  return match ? Number(match[0]) : null;
}
