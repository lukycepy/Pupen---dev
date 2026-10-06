import { NextResponse } from 'next/server';
import { enqueueEventFeedbackRequests } from '@/lib/rsvp/feedbackRequests';
import { getServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

interface EventRow {
  id?: string | null;
  title?: string | null;
  date?: string | null;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function requireCron(req: Request) {
  const url = new URL(req.url);
  const expected = process.env.CRON_SECRET || '';
  if (!expected) return false;
  const got =
    url.searchParams.get('secret') ||
    req.headers.get('x-cron-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  return got === expected;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Error');
}

export async function GET(req: Request) {
  try {
    if (!requireCron(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const limit = Math.min(250, Math.max(1, Number(url.searchParams.get('limit') || 50)));
    const lookbackDays = Math.min(30, Math.max(1, Number(url.searchParams.get('lookbackDays') || 7)));
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - lookbackDays);

    const supabase = getServerSupabase();
    const eventsRes = await supabase
      .from('events')
      .select('id, title, date')
      .gte('date', formatDateOnly(startDate))
      .lte('date', formatDateOnly(endDate))
      .order('date', { ascending: false })
      .limit(limit);
    if (eventsRes.error) throw eventsRes.error;

    const events = (eventsRes.data || []) as EventRow[];
    let processedEvents = 0;
    let enqueued = 0;
    let recipientsTotal = 0;
    let skippedExisting = 0;
    let skippedMissingEmail = 0;
    const errors: Array<{ eventId: string; error: string }> = [];

    for (const event of events) {
      const eventId = String(event.id || '');
      if (!eventId) continue;
      processedEvents += 1;
      try {
        const result = await enqueueEventFeedbackRequests({
          supabase,
          eventId,
          force: false,
          actorEmail: 'cron',
          actorName: 'event-feedback-cron',
          source: 'cron',
        });
        recipientsTotal += result.total;
        enqueued += result.enqueued;
        skippedExisting += result.skippedExisting;
        skippedMissingEmail += result.skippedMissingEmail;
      } catch (error: unknown) {
        errors.push({ eventId, error: getErrorMessage(error) });
      }
    }

    return NextResponse.json({
      ok: true,
      processedEvents,
      recipientsTotal,
      enqueued,
      skippedExisting,
      skippedMissingEmail,
      errors,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
