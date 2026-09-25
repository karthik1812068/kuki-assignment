import { INDEX_LIMITS } from './limits';
import { extractSymbols } from './symbols';

export interface SourceFile {
  path: string;
  language: string | null;
  text: string;
}

export interface ChunkDraft {
  path: string;
  symbol: string | null;
  language: string | null;
  startLine: number;
  endLine: number;
  content: string;
}

export function chunkSource(file: SourceFile): ChunkDraft[] {
  const lines = file.text.split('\n');
  const symbols = extractSymbols(file.language, lines);
  if (symbols.length === 0) {
    return windowChunks(file, lines);
  }

  const drafts: ChunkDraft[] = [];
  for (let index = 0; index < symbols.length; index += 1) {
    const symbol = symbols[index];
    if (!symbol) {
      continue;
    }
    const next = symbols[index + 1];
    const endLine = next ? Math.max(symbol.startLine, next.startLine - 1) : lines.length;
    const taken = takeLines(lines, symbol.startLine, endLine);
    if (!taken) {
      continue;
    }
    drafts.push({
      path: file.path,
      symbol: symbol.name,
      language: file.language,
      startLine: symbol.startLine,
      endLine: taken.endLine,
      content: taken.content,
    });
  }
  return drafts;
}

function windowChunks(file: SourceFile, lines: string[]): ChunkDraft[] {
  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
    return [];
  }
  const drafts: ChunkDraft[] = [];
  const step = INDEX_LIMITS.windowLines - INDEX_LIMITS.windowOverlap;
  for (let start = 1; start <= lines.length; start += step) {
    const end = Math.min(lines.length, start + INDEX_LIMITS.windowLines - 1);
    const taken = takeLines(lines, start, end);
    if (taken) {
      drafts.push({
        path: file.path,
        symbol: null,
        language: file.language,
        startLine: start,
        endLine: taken.endLine,
        content: taken.content,
      });
    }
    if (end >= lines.length) {
      break;
    }
  }
  return drafts;
}

function takeLines(
  lines: readonly string[],
  startLine: number,
  endLine: number,
): { content: string; endLine: number } | null {
  const parts: string[] = [];
  let size = 0;
  let actualEnd = startLine;
  for (
    let lineNumber = startLine;
    lineNumber <= endLine && lineNumber <= lines.length;
    lineNumber += 1
  ) {
    const line = (lines[lineNumber - 1] ?? '').slice(0, INDEX_LIMITS.maxChunkChars);
    if (size + line.length + 1 > INDEX_LIMITS.maxChunkChars && parts.length > 0) {
      break;
    }
    parts.push(line);
    size += line.length + 1;
    actualEnd = lineNumber;
  }
  if (parts.length === 0) {
    return null;
  }
  return { content: parts.join('\n'), endLine: actualEnd };
}
