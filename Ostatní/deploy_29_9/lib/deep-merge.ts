function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function deepMerge<T, U>(base: T, patch: U): T & U {
  if (patch === undefined) return base as unknown as T & U;
  if (Array.isArray(base) || Array.isArray(patch)) return patch as unknown as T & U;
  if (isPlainObject(base) && isPlainObject(patch)) {
    const baseRecord = base as Record<string, unknown>;
    const out: Record<string, unknown> = { ...baseRecord };
    for (const [k, v] of Object.entries(patch)) {
      out[k] = deepMerge(baseRecord[k], v);
    }
    return out as T & U;
  }
  return patch as unknown as T & U;
}
