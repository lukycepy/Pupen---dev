interface ErrorLike {
  message?: unknown;
}

interface ResultWithError {
  error?: unknown;
}

interface SchemaCacheSupabase {
  rpc(fn: string): PromiseLike<ResultWithError> | ResultWithError;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as ErrorLike).message || '');
  }
  return '';
}

export function isSchemaCacheError(error: unknown) {
  const msg = getErrorMessage(error);
  return msg.toLowerCase().includes('schema cache');
}

function isMissingRpcFunction(error: unknown, fn: string) {
  const msg = getErrorMessage(error);
  return msg.includes('Could not find the function') && msg.includes(fn);
}

export async function tryReloadSchemaCache(supabase: SchemaCacheSupabase) {
  try {
    const res = await supabase.rpc('admin_reload_schema_cache');
    if (res.error) throw res.error;
    return { ok: true as const };
  } catch (error: unknown) {
    if (isMissingRpcFunction(error, 'admin_reload_schema_cache')) return { ok: false as const, skipped: 'missing_rpc' as const };
    return { ok: false as const, error };
  }
}

export async function withSchemaCacheRetry<T extends ResultWithError>(supabase: SchemaCacheSupabase, fn: () => PromiseLike<T>): Promise<T> {
  try {
    const res = await fn();
    const err = res?.error;
    if (!err || !isSchemaCacheError(err)) return res;
    await tryReloadSchemaCache(supabase);
    return await fn();
  } catch (error: unknown) {
    if (!isSchemaCacheError(error)) throw error;
    await tryReloadSchemaCache(supabase);
    return await fn();
  }
}
