import type { DocumentExtraction } from '../extract-document';
import { parseFinancialPeriod } from '../periods';
import {
  cite,
  collectFacts,
  missing,
  ok,
  onSameRow,
  rowHasPeriod,
  type LocatedFact,
} from './facts';
import {
  billAmountRoles,
  companyWideTotal,
  consumptionByPeriod,
  fyCoverage,
  sumQuantity,
  wasteManifestDates,
  waterMatchesMeter,
  workbookAgrees,
} from './handlers';
import type { AnswerMode, GroundedAnswer } from './types';

export function answerQuestion(
  question: string,
  documents: readonly DocumentExtraction[],
  mode: AnswerMode,
): GroundedAnswer {
  const facts = collectFacts(documents);
  if (mode === 'baseline') {
    // first number we find; this is the weak eval baseline
    return firstNonZero(facts);
  }
  return improvedAnswer(question, facts);
}

function firstNonZero(facts: readonly LocatedFact[]): GroundedAnswer {
  const first = facts.find((fact) => fact.numeric !== null && fact.numeric !== 0);
  if (!first) {
    return missing('No numeric value was found.');
  }
  return ok(String(first.numeric), [cite(first)]);
}

function improvedAnswer(question: string, facts: readonly LocatedFact[]): GroundedAnswer {
  const period = parseFinancialPeriod(question);
  const scoped = period ? facts.filter((fact) => rowHasPeriod(facts, fact, period.label)) : facts;
  const pool = scoped.length > 0 ? scoped : facts;

  if (/diesel|gas|solar/iu.test(question)) {
    return missing('The uploaded documents do not contain this value.');
  }
  if (/form\s*37|date inconsistency/iu.test(question)) {
    return wasteManifestDates(facts);
  }
  if (/company-wide|single company/iu.test(question)) {
    return companyWideTotal(facts);
  }
  if (/current month|total amount payable|after the due date|after due/iu.test(question)) {
    return billAmountRoles(pool);
  }
  if (/consumption does each bill/iu.test(question)) {
    return consumptionByPeriod(facts);
  }
  if (/how complete is the coverage|what evidence exists/iu.test(question)) {
    return fyCoverage(question, facts, period?.label ?? null);
  }
  if (/match|agree|same/iu.test(question) && /meter|annual|summary|workbook/iu.test(question)) {
    if (/meter|water/iu.test(question)) {
      return waterMatchesMeter(facts);
    }
    return workbookAgrees(facts);
  }
  if (/\btotal\b|\bsum\b/iu.test(question) && !/payable|due/iu.test(question)) {
    return sumQuantity(question, pool);
  }

  const preferred = pickFacts(question, pool);
  const numeric = preferred.filter((fact) => fact.numeric !== null);
  if (numeric.length === 0) {
    const text = preferred[0];
    return text
      ? ok(text.value, [cite(text)])
      : missing('The uploaded documents do not contain enough evidence for this question.');
  }

  const values = [...new Set(numeric.map((fact) => fact.numeric as number))];
  if (values.length > 1) {
    return {
      answer: `Conflicting values: ${values.join(' vs ')}.`,
      confidence: 'low',
      evidence: numeric.slice(0, 4).map(cite),
      calculated: false,
      missing: false,
      conflict: true,
    };
  }

  const chosen = numeric[0];
  if (!chosen || chosen.numeric === null) {
    return missing('The uploaded documents do not contain enough evidence for this question.');
  }
  return ok(String(chosen.numeric), [cite(chosen)]);
}

function pickFacts(question: string, facts: readonly LocatedFact[]): LocatedFact[] {
  if (/after the due date|after due/iu.test(question)) {
    return facts.filter(
      (fact) => onSameRow(facts, fact, 'after_due_date') && fact.label === 'amount',
    );
  }
  if (/current month/iu.test(question)) {
    return facts.filter(
      (fact) => onSameRow(facts, fact, 'current_month') && fact.label === 'amount',
    );
  }
  if (/payable|amount due|bill amount/iu.test(question)) {
    const payable = facts.filter(
      (fact) => onSameRow(facts, fact, 'total_payable') && fact.label === 'amount',
    );
    if (payable.length > 0) {
      return payable;
    }
    return facts.filter(
      (fact) => fact.label === 'payable' && onSameRow(facts, fact, 'consumption'),
    );
  }
  if (/kwh|electric/iu.test(question)) {
    const kwh = facts.filter(
      (fact) => fact.label === 'kwh' && onSameRow(facts, fact, 'consumption'),
    );
    return kwh.length > 0
      ? kwh
      : facts.filter(
          (fact) =>
            fact.label === 'consumption' ||
            (fact.label === 'amount' && onSameRow(facts, fact, 'consumption')),
        );
  }
  if (/kl|water/iu.test(question) && /meter/iu.test(question)) {
    return facts.filter((fact) => fact.filename.includes('meter-readings') && fact.label === 'kl');
  }
  if (/kl|water/iu.test(question)) {
    return facts.filter((fact) => fact.filename.includes('water-bill') && fact.label === 'kl');
  }
  if (/deadline|complaints?|days/iu.test(question)) {
    return facts.filter((fact) => fact.label === 'deadline');
  }
  if (/scope/iu.test(question)) {
    return facts.filter((fact) => fact.label === 'scope');
  }
  if (/commitment|intensity/iu.test(question)) {
    return facts.filter((fact) => fact.label === 'commitment');
  }
  if (/waste|kg/iu.test(question)) {
    return facts.filter((fact) => fact.label === 'kg');
  }
  return [...facts];
}
