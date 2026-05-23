export function isSchemaCacheError(e: any) {
  const msg = String(e?.message || '');
  return msg.toLowerCase().includes('schema cache');
}

function isMissingRpcFunction(e: any, fn: string) {
  const msg = String(e?.message || '');
  return msg.includes('Could not find the function') && msg.includes(fn);
}

export async function tryReloadSchemaCache(supabase: any) {
  try {
    const res = await supabase.rpc('admin_reload_schema_cache');
    if (res?.error) throw res.error;
    return { ok: true as const };
  } catch (e: any) {
    if (isMissingRpcFunction(e, 'admin_reload_schema_cache')) return { ok: false as const, skipped: 'missing_rpc' as const };
    return { ok: false as const, error: e };
  }
}

export async function withSchemaCacheRetry<T>(supabase: any, fn: () => PromiseLike<T>): Promise<T> {
  try {
    const res: any = await fn();
    const err = (res as any)?.error;
    if (!err || !isSchemaCacheError(err)) return res;
    await tryReloadSchemaCache(supabase);
    return await fn();
  } catch (e: any) {
    if (!isSchemaCacheError(e)) throw e;
    await tryReloadSchemaCache(supabase);
    return await fn();
  }
}
