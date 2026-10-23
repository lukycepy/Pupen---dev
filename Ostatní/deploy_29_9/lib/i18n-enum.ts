function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function getDictPath(dict: unknown, path: string) {
  const parts = String(path || '').split('.').filter(Boolean);
  let cur: unknown = dict;
  for (const p of parts) {
    const currentRecord = toRecord(cur);
    if (!currentRecord) return undefined;
    cur = currentRecord[p];
  }
  return cur;
}

export function tEnum(dict: unknown, basePath: string, value: unknown, fallback?: string) {
  const v = String(value ?? '').trim();
  if (!v) return fallback ?? '—';
  const table = getDictPath(dict, basePath);
  const tableRecord = toRecord(table);
  if (tableRecord && v in tableRecord) return String(tableRecord[v]);
  return fallback ?? v;
}
