import { cite, missing, ok, onSameRow, rowHasPeriod, sibling, type LocatedFact } from './facts';
import type { GroundedAnswer } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export function billAmountRoles(facts: readonly LocatedFact[]): GroundedAnswer {
  const current = amountRole(facts, 'current_month');
  const total = amountRole(facts, 'total_payable');
  const late = amountRole(facts, 'after_due_date');
  if (!current || !total || !late) {
    return missing('The uploaded documents do not contain enough evidence for this question.');
  }
  return ok(
    `Current month ${current.numeric} vs total payable ${total.numeric}; after due date ${late.numeric}.`,
    [cite(current), cite(total), cite(late)],
  );
}

export function consumptionByPeriod(facts: readonly LocatedFact[]): GroundedAnswer {
  const rows = facts.filter(
    (fact) =>
      (fact.label === 'kwh' || fact.label === 'amount') &&
      onSameRow(facts, fact, 'consumption') &&
      fact.numeric !== null,
  );
  if (rows.length === 0) {
    return missing('The uploaded documents do not contain enough evidence for this question.');
  }
  const parts = rows.map((fact) => {
    const period = sibling(facts, fact, 'period')?.value ?? 'unspecified period';
    return `${fact.numeric} (${period}, ${fact.filename})`;
  });
  return ok(parts.join('; '), rows.map(cite));
}

export function wasteManifestDates(facts: readonly LocatedFact[]): GroundedAnswer {
  const generation = facts.find(
    (fact) =>
      fact.filename.includes('form37') &&
      ISO_DATE.test(fact.value) &&
      onSameRow(facts, fact, 'generation_date'),
  );
  const dispatch = facts.find(
    (fact) =>
      fact.filename.includes('form37') &&
      ISO_DATE.test(fact.value) &&
      onSameRow(facts, fact, 'dispatch_date'),
  );
  if (!generation || !dispatch) {
    return missing('The uploaded documents do not contain enough evidence for this question.');
  }
  const conflict = Date.parse(dispatch.value) < Date.parse(generation.value);
  return ok(
    conflict ? `yes: dispatch ${dispatch.value} is before generation ${generation.value}` : 'no',
    [cite(generation), cite(dispatch)],
    { conflict },
  );
}

export function companyWideTotal(facts: readonly LocatedFact[]): GroundedAnswer {
  const orgs = [...new Set(facts.filter((fact) => fact.label === 'org').map((fact) => fact.value))];
  if (orgs.length < 2) {
    return ok(
      'yes',
      facts
        .filter((fact) => fact.label === 'org')
        .slice(0, 2)
        .map(cite),
    );
  }
  const evidence = orgs.flatMap((org) => {
    const fact = facts.find((item) => item.label === 'org' && item.value === org);
    return fact ? [cite(fact)] : [];
  });
  return ok(
    `no: documents include ${orgs.join(' and ')}, so a single company-wide total is not supported.`,
    evidence,
    { conflict: true },
  );
}

export function fyCoverage(
  question: string,
  facts: readonly LocatedFact[],
  fyLabel: string | null,
): GroundedAnswer {
  const wantsEmptyYear = /2025-26|FY2026/iu.test(question) || fyLabel === 'FY2026';
  const kwh = facts.filter((fact) => {
    const isUse =
      fact.label === 'kwh' || (fact.label === 'amount' && onSameRow(facts, fact, 'consumption'));
    return isUse && fact.numeric !== null && (!fyLabel || rowHasPeriod(facts, fact, fyLabel));
  });
  if (kwh.length === 0) {
    if (wantsEmptyYear) {
      return missing('No evidence for FY 2025-26. Coverage is incomplete.');
    }
    return missing('No electricity evidence for that financial year. Coverage is incomplete.');
  }
  const parts = kwh.map((fact) => {
    const org = sibling(facts, fact, 'org')?.value ?? fact.filename;
    return `${org} ${fact.numeric} kWh`;
  });
  return ok(`${parts.join('; ')}. Coverage is complete for the documents on file.`, kwh.map(cite));
}

export function waterMatchesMeter(facts: readonly LocatedFact[]): GroundedAnswer {
  const bill = facts.find(
    (fact) => fact.filename.includes('water-bill') && fact.label === 'kl' && fact.numeric !== null,
  );
  const meter = facts.find(
    (fact) =>
      fact.filename.includes('meter-readings') && fact.label === 'kl' && fact.numeric !== null,
  );
  if (!bill || !meter || bill.numeric === null || meter.numeric === null) {
    return missing('The uploaded documents do not contain enough evidence for this question.');
  }
  const same = bill.numeric === meter.numeric;
  return ok(same ? 'yes' : 'no', [cite(bill), cite(meter)], { conflict: !same });
}

export function sumQuantity(question: string, facts: readonly LocatedFact[]): GroundedAnswer {
  const label = /waste|kg/iu.test(question) ? 'kg' : /kl|water/iu.test(question) ? 'kl' : 'kwh';
  const monthly = facts.filter(
    (fact) =>
      fact.label === label &&
      fact.numeric !== null &&
      fact.value !== 'annual_summary' &&
      !/Year|annual/iu.test(fact.value),
  );
  if (monthly.length < 2) {
    return missing('The uploaded documents do not contain enough evidence for this question.');
  }
  const sum = monthly.reduce((total, fact) => total + (fact.numeric ?? 0), 0);
  return ok(String(sum), monthly.map(cite), { calculated: true });
}

export function workbookAgrees(facts: readonly LocatedFact[]): GroundedAnswer {
  const monthly = facts.filter(
    (fact) =>
      fact.filename.includes('monthly-workbook') &&
      fact.label === 'kwh' &&
      fact.numeric !== null &&
      onSameRow(facts, fact, 'monthly'),
  );
  const annual = facts.find(
    (fact) =>
      fact.filename.includes('monthly-workbook') &&
      fact.label === 'kwh' &&
      fact.numeric !== null &&
      onSameRow(facts, fact, 'annual_summary'),
  );
  if (!annual || annual.numeric === null || monthly.length === 0) {
    return missing('The uploaded documents do not contain enough evidence for this question.');
  }
  const sum = monthly.reduce((total, fact) => total + (fact.numeric ?? 0), 0);
  const same = sum === annual.numeric;
  return ok(
    same ? `yes (${sum})` : `no (${sum} vs ${annual.numeric})`,
    [...monthly.map(cite), cite(annual)],
    {
      calculated: true,
      conflict: !same,
    },
  );
}

function amountRole(facts: readonly LocatedFact[], role: string): LocatedFact | undefined {
  return facts.find(
    (fact) => fact.label === 'amount' && onSameRow(facts, fact, role) && fact.numeric !== null,
  );
}
