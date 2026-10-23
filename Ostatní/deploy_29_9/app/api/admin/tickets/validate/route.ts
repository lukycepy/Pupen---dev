import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { loadTicketValidation } from '@/lib/tickets/validation';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || '';
    const eventId = url.searchParams.get('eventId') || '';
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'cs';
    const supabase = getServerSupabase();

    const result = await loadTicketValidation(supabase, { token, eventId, lang });
    if (!result.found) {
      return NextResponse.json({ ok: false, status: 'invalid' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
