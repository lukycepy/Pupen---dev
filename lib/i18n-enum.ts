export function getDictPath(dict: any, path: string) {
  const parts = String(path || '').split('.').filter(Boolean);
  let cur: any = dict;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

export function tEnum(dict: any, basePath: string, value: any, fallback?: string) {
  const v = String(value ?? '').trim();
  if (!v) return fallback ?? '—';
  const table = getDictPath(dict, basePath);
  if (table && typeof table === 'object' && v in table) return String(table[v]);
  return fallback ?? v;
}

