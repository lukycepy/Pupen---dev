import { NextResponse } from 'next/server';
import { enqueueEventFeedbackRequests } from '@/lib/rsvp/feedbackRequests';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Error');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const eventId = String(body.eventId || body.event_id || '').trim();
    const force = body.force === true;
    if (!isUuid(eventId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

    const supabase = getServerSupabase();
    const result = await enqueueEventFeedbackRequests({
      supabase,
      eventId,
      force,
      actorEmail: user.email || 'admin',
      actorName: user.user_metadata?.full_name || user.email || 'admin',
      source: 'admin',
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : message === 'Event not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
