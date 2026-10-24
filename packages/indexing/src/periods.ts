export type FinancialPeriodKind = 'fiscal' | 'calendar';

export interface FinancialPeriod {
  kind: FinancialPeriodKind;
  startYear: number;
  endYear: number;
  label: string;
  query: string;
}

export function parseFinancialPeriod(text: string): FinancialPeriod | null {
  const source = text.replaceAll('\u2013', '-').replaceAll('\u2014', '-');
  const fiscalRange =
    /\b(?:FY|F\.Y\.|financial year|fiscal year)\s*(20\d{2})\s*[-/]\s*(?:20)?(\d{2})\b/iu.exec(
      source,
    ) ?? /\b(20\d{2})\s*[-/]\s*(?:20)?(\d{2})\b/u.exec(hasYearCue(source) ? source : '');
  if (fiscalRange) {
    const startYear = Number(fiscalRange[1]);
    const endToken = fiscalRange[2] ?? '';
    const endYear = endToken.length === 2 ? 2000 + Number(endToken) : Number(endToken);
    if (isYear(startYear) && isYear(endYear) && endYear === startYear + 1) {
      return fiscal(startYear, endYear);
    }
  }
  const fySingle = /\b(?:FY|F\.Y\.|financial year|fiscal year)\s*(20\d{2})\b/iu.exec(source);
  if (fySingle) {
    const endYear = Number(fySingle[1]);
    if (isYear(endYear)) {
      return fiscal(endYear - 1, endYear);
    }
  }
  const calendar = /\b(?:CY|calendar year|calendar)\s*(20\d{2})\b/iu.exec(source);
  if (calendar) {
    const year = Number(calendar[1]);
    if (isYear(year)) {
      return {
        kind: 'calendar',
        startYear: year,
        endYear: year,
        label: `CY${year}`,
        query: `CY${year}`,
      };
    }
  }
  return null;
}

export function periodMatchScore(query: string, content: string): number {
  const period = parseFinancialPeriod(query);
  if (!period) {
    return 0;
  }
  const haystack = content.replaceAll('\u2013', '-').toLowerCase();
  const end = String(period.endYear);
  const start = String(period.startYear);
  const short = `${start.slice(2)}-${end.slice(2)}`;
  let score = 0;
  if (period.kind === 'fiscal') {
    if (
      haystack.includes(`fy${end}`) ||
      haystack.includes(`fy ${end}`) ||
      haystack.includes(`financial year ${end}`)
    ) {
      score += 0.7;
    }
    if (haystack.includes(`${start}-${end}`) || haystack.includes(short)) {
      score += 0.25;
    }
  } else if (haystack.includes(`cy${end}`) || haystack.includes(`calendar year ${end}`)) {
    score += 0.7;
  }
  if (haystack.includes(end)) {
    score += 0.1;
  }
  if (
    period.kind === 'fiscal' &&
    /\bcalendar year 20\d{2}\b/u.test(haystack) &&
    !haystack.includes(`fy${end}`)
  ) {
    score = Math.max(0, score - 0.4);
  }
  return Math.min(1, score);
}

function fiscal(startYear: number, endYear: number): FinancialPeriod {
  return {
    kind: 'fiscal',
    startYear,
    endYear,
    label: `FY${endYear}`,
    query: `FY${endYear}`,
  };
}

function hasYearCue(text: string): boolean {
  return /\b(FY|F\.Y\.|financial year|fiscal year|revenue|accounts)\b/iu.test(text);
}

function isYear(value: number): boolean {
  return Number.isInteger(value) && value >= 2000 && value <= 2099;
}
