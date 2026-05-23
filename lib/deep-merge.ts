function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function deepMerge<T>(base: T, patch: any): T {
  if (patch === undefined) return base;
  if (Array.isArray(base) || Array.isArray(patch)) return patch as T;
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out: Record<string, unknown> = { ...(base as any) };
    for (const [k, v] of Object.entries(patch)) {
      out[k] = deepMerge((base as any)[k], v);
    }
    return out as T;
  }
  return patch as T;
}
