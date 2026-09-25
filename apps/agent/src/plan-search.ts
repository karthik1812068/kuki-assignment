const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'into',
  'your',
  'task',
  'find',
  'locate',
  'search',
  'look',
  'show',
  'list',
  'read',
  'make',
  'add',
  'update',
  'change',
  'fix',
  'create',
  'remove',
  'delete',
  'implement',
  'write',
  'function',
  'method',
  'class',
  'file',
  'code',
  'please',
]);

export function planSearchQuery(title: string, description: string): string {
  const file = mentionedPaths(title, description)[0];
  if (file) {
    return file.slice(0, 200);
  }
  const tokens = `${title}\n${description}`.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? [];
  const useful = tokens.filter((token) => !STOP_WORDS.has(token.toLowerCase()));
  const ranked = [...useful].sort((left, right) => right.length - left.length);
  const chosen = ranked[0] ?? tokens[0] ?? title;
  return chosen.slice(0, 200);
}

export function mentionedPaths(title: string, description: string): string[] {
  const found =
    `${title}\n${description}`.match(/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.[A-Za-z0-9]{1,8}/g) ??
    [];
  const paths: string[] = [];
  for (const file of found) {
    if (file.includes('..') || paths.includes(file)) {
      continue;
    }
    paths.push(file);
    if (paths.length === 3) {
      break;
    }
  }
  return paths;
}
