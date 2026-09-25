export interface SourceSymbol {
  name: string;
  startLine: number;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]{0,80}$/;

const CODE_RULES: Record<string, readonly RegExp[]> = {
  TypeScript: [
    /^\s*(?:export\s+)?(?:declare\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
    /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
    /^\s*(?:export\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/,
  ],
  JavaScript: [
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
    /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/,
  ],
  Python: [/^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)/, /^\s*class\s+([A-Za-z_][\w]*)/],
  Go: [/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_][\w]*)/],
  Rust: [
    /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)/,
    /^\s*(?:pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_][\w]*)/,
  ],
  Java: [
    /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:class|interface|enum)\s+([A-Za-z_][\w]*)/,
  ],
};

export function extractSymbols(language: string | null, lines: readonly string[]): SourceSymbol[] {
  if (language === 'Markdown') {
    return markdownSymbols(lines);
  }
  const rules = language ? CODE_RULES[language] : undefined;
  if (!rules) {
    return [];
  }
  const symbols: SourceSymbol[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').slice(0, 500);
    for (const rule of rules) {
      const match = rule.exec(line);
      const name = match?.[1];
      if (name && IDENTIFIER.test(name)) {
        symbols.push({ name, startLine: index + 1 });
        break;
      }
    }
  }
  return symbols;
}

function printable(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 0x20 && code <= 0x7e) {
      result += char;
    }
  }
  return result.trim();
}

function markdownSymbols(lines: readonly string[]): SourceSymbol[] {
  const symbols: SourceSymbol[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\s{0,3}#{1,6}\s+(\S.*?)\s*$/.exec((lines[index] ?? '').slice(0, 240));
    const title = match?.[1] ? printable(match[1]) : '';
    if (!title) {
      continue;
    }
    symbols.push({ name: title.slice(0, 80), startLine: index + 1 });
  }
  return symbols;
}
