const STATUSES = new Set(['queued', 'processing', 'completed', 'failed', 'duplicate']);
const KINDS = new Set(['bill', 'spreadsheet', 'record', 'policy', 'unknown']);

export interface PublicDocument {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  kind: string;
  status: string;
  error: string | null;
  duplicateOf: string | null;
  financialYears: string[];
  facts: Array<{ label: string; value: string; calculated: boolean; source: { locator: string } }>;
  excerpt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export function parseDocument(value: unknown): PublicDocument | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(record.id)) {
    return null;
  }
  if (typeof record.filename !== 'string' || typeof record.status !== 'string') {
    return null;
  }
  if (!STATUSES.has(record.status) || typeof record.kind !== 'string' || !KINDS.has(record.kind)) {
    return null;
  }
  return {
    id: record.id,
    filename: record.filename.slice(0, 200),
    contentType:
      typeof record.contentType === 'string'
        ? record.contentType.slice(0, 80)
        : 'application/octet-stream',
    byteSize: typeof record.byteSize === 'number' ? record.byteSize : 0,
    kind: record.kind,
    status: record.status,
    error: typeof record.error === 'string' ? record.error.slice(0, 300) : null,
    duplicateOf: typeof record.duplicateOf === 'string' ? record.duplicateOf : null,
    financialYears: Array.isArray(record.financialYears)
      ? record.financialYears.filter((item): item is string => typeof item === 'string').slice(0, 8)
      : [],
    facts: readFacts(record.facts),
    excerpt: typeof record.excerpt === 'string' ? record.excerpt.slice(0, 1_200) : '',
    startedAt: typeof record.startedAt === 'string' ? record.startedAt : null,
    completedAt: typeof record.completedAt === 'string' ? record.completedAt : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
  };
}

export function parseDocumentList(value: unknown): PublicDocument[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const documents: PublicDocument[] = [];
  for (const entry of value) {
    const document = parseDocument(entry);
    if (!document) {
      return null;
    }
    documents.push(document);
  }
  return documents;
}

function readFacts(value: unknown): PublicDocument['facts'] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const source =
      record.source && typeof record.source === 'object'
        ? (record.source as Record<string, unknown>)
        : {};
    if (typeof record.label !== 'string' || typeof record.value !== 'string') {
      return [];
    }
    return [
      {
        label: record.label.slice(0, 80),
        value: record.value.slice(0, 200),
        calculated: record.calculated === true,
        source: {
          locator: typeof source.locator === 'string' ? source.locator.slice(0, 120) : 'document',
        },
      },
    ];
  });
}
