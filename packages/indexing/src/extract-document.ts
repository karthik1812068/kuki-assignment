import { inflateRawSync } from 'node:zlib';
import { parseFinancialPeriod } from './periods';

export const DOCUMENT_KINDS = ['bill', 'spreadsheet', 'record', 'policy', 'unknown'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface ExtractedFact {
  label: string;
  value: string;
  calculated: boolean;
  source: { locator: string };
}

export interface DocumentExtraction {
  kind: DocumentKind;
  filename: string;
  facts: ExtractedFact[];
  financialYears: string[];
  excerpt: string;
}

const MAX_TEXT = 200_000;

export function extractDocument(filename: string, bytes: Buffer): DocumentExtraction {
  const kind = classifyKind(filename);
  const extension = extensionOf(filename);
  const text =
    extension === 'csv' || extension === 'txt' || extension === 'md' || extension === 'json'
      ? bytes.toString('utf8')
      : extension === 'pdf'
        ? extractPdfText(bytes)
        : extension === 'xlsx' || extension === 'xls'
          ? extractSpreadsheetText(bytes)
          : bytes.toString('utf8');
  const clipped = text.replaceAll('\0', '').slice(0, MAX_TEXT);
  const facts = extractFacts(clipped, extension);
  const years = uniqueYears(clipped);
  return {
    kind,
    filename: filename.slice(0, 200),
    facts: facts.slice(0, 80),
    financialYears: years,
    excerpt: clipped.slice(0, 1_200),
  };
}

export function classifyKind(filename: string): DocumentKind {
  const name = filename.toLowerCase();
  if (/(bill|invoice|electric|water|utility)/u.test(name)) {
    return 'bill';
  }
  if (/\.(xlsx|xls|csv)$/u.test(name) || /(workbook|spreadsheet|monthly)/u.test(name)) {
    return 'spreadsheet';
  }
  if (/(policy|quality|complaint|commitment)/u.test(name)) {
    return 'policy';
  }
  if (/(record|meter|waste|log|form37|form-37|hazardous)/u.test(name)) {
    return 'record';
  }
  return 'unknown';
}

function extractFacts(text: string, extension: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  if (extension === 'csv') {
    const rows = parseCsv(text).slice(0, 40);
    const header = rows[0] ?? [];
    rows.slice(1).forEach((row, index) => {
      header.forEach((column, columnIndex) => {
        const value = row[columnIndex]?.trim() ?? '';
        if (!column || !value) {
          return;
        }
        facts.push({
          label: column.slice(0, 80),
          value: value.slice(0, 200),
          calculated: false,
          source: { locator: `sheet row ${index + 2} column ${column}` },
        });
      });
    });
    return facts;
  }
  const lines = text
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .slice(0, 80);
  for (const [index, line] of lines.entries()) {
    const amount = /(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]+(?:\.[0-9]+)?)/iu.exec(
      line,
    );
    const period = parseFinancialPeriod(line);
    if (period) {
      facts.push({
        label: 'financial_year',
        value: period.label,
        calculated: false,
        source: { locator: `line ${index + 1}` },
      });
    }
    if (amount && /(?:amount|total|payable|consumption|kwh|kl|kg|qty|quantity)/iu.test(line)) {
      facts.push({
        label: 'amount',
        value: amount[1] ?? amount[0] ?? '',
        calculated: false,
        source: { locator: `line ${index + 1}` },
      });
    }
    if (/(deadline|within \d+|scope|commitment|complaints?)/iu.test(line)) {
      facts.push({
        label: /scope/iu.test(line)
          ? 'scope'
          : /commitment/iu.test(line)
            ? 'commitment'
            : 'deadline',
        value: line.trim().slice(0, 200),
        calculated: false,
        source: { locator: `line ${index + 1}` },
      });
    }
  }
  return facts;
}

function uniqueYears(text: string): string[] {
  const found: string[] = [];
  const period = parseFinancialPeriod(text);
  if (period) {
    found.push(period.label);
  }
  const matches = text.match(/\bFY\s*20\d{2}\s*[-/]\s*(?:20)?\d{2}\b/giu) ?? [];
  for (const match of matches) {
    const parsed = parseFinancialPeriod(match);
    if (parsed && !found.includes(parsed.label)) {
      found.push(parsed.label);
    }
  }
  return found.slice(0, 8);
}

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/u)
    .filter((line) => line.length > 0)
    .slice(0, 200)
    .map((line) => line.split(',').map((cell) => cell.trim().replaceAll(/^"|"$/g, '')));
}

function extractPdfText(bytes: Buffer): string {
  const source = bytes.toString('latin1');
  const parts: string[] = [];
  const pattern = /\((?:\\.|[^\\)]){2,}/gu;
  for (const match of source.match(pattern) ?? []) {
    const raw = match.slice(1);
    const text = raw
      .replaceAll('\\n', '\n')
      .replaceAll('\\r', '')
      .replaceAll('\\t', ' ')
      .replaceAll('\\(', '(')
      .replaceAll('\\)', ')')
      .replaceAll('\\\\', '\\');
    if (/[A-Za-z0-9]/.test(text)) {
      parts.push(text);
    }
    if (parts.join('\n').length > MAX_TEXT) {
      break;
    }
  }
  return parts.join('\n');
}

function extractSpreadsheetText(bytes: Buffer): string {
  if (bytes.subarray(0, 2).toString('utf8') !== 'PK') {
    return bytes.toString('utf8');
  }
  const files = readZipTexts(bytes);
  const shared = files['xl/sharedStrings.xml'] ?? '';
  const sheet =
    files['xl/worksheets/sheet1.xml'] ??
    Object.entries(files).find(([name]) => name.startsWith('xl/worksheets/'))?.[1] ??
    '';
  const strings = [...shared.matchAll(/<t[^>]*>([^<]*)<\/t>/gu)].map((match) => match[1] ?? '');
  const cells: string[] = [];
  for (const match of sheet.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/gu)) {
    const attrs = match[1] ?? '';
    const inner = match[2] ?? '';
    const ref = /r="([A-Z]+[0-9]+)"/u.exec(attrs)?.[1] ?? 'cell';
    if (/\bt="s"/u.test(attrs)) {
      const index = Number(/<v>(\d+)<\/v>/u.exec(inner)?.[1] ?? '');
      const value = Number.isInteger(index) ? (strings[index] ?? '') : '';
      if (value) {
        cells.push(`${ref}\t${value}`);
      }
    } else {
      const value = /<v>([^<]*)<\/v>/u.exec(inner)?.[1] ?? '';
      if (value) {
        cells.push(`${ref}\t${value}`);
      }
    }
  }
  return [strings.join('\n'), cells.join('\n')].filter(Boolean).join('\n');
}

function readZipTexts(bytes: Buffer): Record<string, string> {
  const files: Record<string, string> = {};
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    if (bytes.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }
    const compression = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const uncompressedSize = bytes.readUInt32LE(offset + 22);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString('utf8');
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) {
      break;
    }
    const payload = bytes.subarray(dataStart, dataEnd);
    if (name && !name.endsWith('/')) {
      try {
        const raw =
          compression === 0 ? payload : compression === 8 ? inflateRawSync(payload) : null;
        if (
          raw &&
          (uncompressedSize === 0 || raw.length === uncompressedSize || compression === 8)
        ) {
          files[name] = raw.toString('utf8');
        }
      } catch {
        // Skip a malformed zip entry and keep the rest of the workbook.
      }
    }
    offset = dataEnd;
  }
  return files;
}

function extensionOf(filename: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/u.exec(filename);
  return match?.[1]?.toLowerCase() ?? '';
}
