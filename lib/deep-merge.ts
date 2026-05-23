function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function deepMerge<T, U>(base: T, patch: U): T & U {
  if (patch === undefined) return base as any;
  if (Array.isArray(base) || Array.isArray(patch)) return patch as any;
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out: Record<string, unknown> = { ...(base as any) };
    for (const [k, v] of Object.entries(patch)) {
      out[k] = deepMerge((base as any)[k], v as any);
    }
    return out as any;
  }
  return patch as any;
}
