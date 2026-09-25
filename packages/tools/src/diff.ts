export function unifiedDiff(filePath: string, before: string, after: string): string {
  const left = before.replace(/\r\n/g, '\n').split('\n');
  const right = after.replace(/\r\n/g, '\n').split('\n');
  const header = `--- a/${filePath}\n+++ b/${filePath}\n`;
  if (left.length > 400 || right.length > 400) {
    return `${header}@@ diff truncated at 400 lines @@\n`;
  }
  const ops = lineDiff(left, right);
  const body = ops
    .map((entry) => `${entry.type}${entry.line}`)
    .join('\n')
    .slice(0, 8_000);
  return `${header}@@ -1,${left.length} +1,${right.length} @@\n${body}\n`;
}

function lineDiff(left: string[], right: string[]): Array<{ type: ' ' | '+' | '-'; line: string }> {
  const n = left.length;
  const m = right.length;
  const scores: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const down = scores[i + 1]?.[j] ?? 0;
      const across = scores[i]?.[j + 1] ?? 0;
      const diagonal = scores[i + 1]?.[j + 1] ?? 0;
      scores[i]![j] = left[i] === right[j] ? diagonal + 1 : Math.max(down, across);
    }
  }
  const ops: Array<{ type: ' ' | '+' | '-'; line: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      ops.push({ type: ' ', line: left[i] ?? '' });
      i += 1;
      j += 1;
      continue;
    }
    const down = scores[i + 1]?.[j] ?? 0;
    const across = scores[i]?.[j + 1] ?? 0;
    if (down >= across) {
      ops.push({ type: '-', line: left[i] ?? '' });
      i += 1;
    } else {
      ops.push({ type: '+', line: right[j] ?? '' });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: '-', line: left[i] ?? '' });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: '+', line: right[j] ?? '' });
    j += 1;
  }
  return ops;
}
