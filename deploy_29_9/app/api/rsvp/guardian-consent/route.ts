import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicPostNoBody } from '@/lib/public-post-guard';
import { ensureGuardianConsentPdf, getMinorAttendees, GUARDIAN_CONSENT_BUCKET, formatGuardianConsentFileName } from '@/lib/rsvp/guardianConsent';

type EventRow = {
  id?: string | null;
  title?: string | null;
  title_en?: string | null;
  date?: string | null;
  location?: string | null;
};

type RsvpRow = {
  id?: string | null;
  event_id?: string | null;
  name?: string | null;
  email?: string | null;
  attendees?: unknown;
  qr_token?: string | null;
  qr_code?: string | null;
  guardian_consent_document_bucket?: string | null;
  guardian_consent_document_path?: string | null;
  guardian_consent_signed_bucket?: string | null;
  guardian_consent_signed_path?: string | null;
};

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isMissingColumnError(message: string) {
  return /(guardian_consent_|qr_token|qr_code)/i.test(message) && /(schema cache|does not exist|column)/i.test(message);
}

function fileExt(name: string) {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : '';
}

async function loadRsvpByToken(supabase: ReturnType<typeof getServerSupabase>, token: string) {
  const withExtras =
    'id, event_id, name, email, attendees, qr_token, qr_code, guardian_consent_document_bucket, guardian_consent_document_path, guardian_consent_signed_bucket, guardian_consent_signed_path';
  const fallback = 'id, event_id, name, email, attendees, qr_token, qr_code';
  let res = await supabase.from('rsvp').select(withExtras).or(`qr_token.eq.${token},qr_code.eq.${token}`).maybeSingle();
  if (res.error && isMissingColumnError(res.error.message)) {
    res = await supabase.from('rsvp').select(fallback).or(`qr_token.eq.${token},qr_code.eq.${token}`).maybeSingle();
  }
  if (res.error) throw res.error;
  return (res.data || null) as RsvpRow | null;
}

export async function GET(req: Request) {
  try {
    const supabase = getServerSupabase();
    const url = new URL(req.url);
    const token = asTrimmedString(url.searchParams.get('token'));
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'cs';
    const signed = url.searchParams.get('signed') === '1';
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const rsvp = await loadRsvpByToken(supabase, token);
    if (!rsvp?.id || !rsvp.event_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const eventRes = await supabase.from('events').select('id, title, title_en, date, location').eq('id', String(rsvp.event_id)).maybeSingle();
    if (eventRes.error) throw eventRes.error;
    const event = (eventRes.data || null) as EventRow | null;
    if (!event?.id) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const minors = getMinorAttendees(rsvp.attendees, event.date);
    if (!minors.length) return NextResponse.json({ error: 'Consent not required' }, { status: 404 });

    let bucket = signed ? asTrimmedString(rsvp.guardian_consent_signed_bucket) : asTrimmedString(rsvp.guardian_consent_document_bucket);
    let path = signed ? asTrimmedString(rsvp.guardian_consent_signed_path) : asTrimmedString(rsvp.guardian_consent_document_path);

    if (!signed) {
      const ensured = await ensureGuardianConsentPdf({ event, rsvp: { ...rsvp }, minors, lang });
      bucket = ensured.bucket || bucket;
      path = ensured.path || path;
    }

    if (!bucket || !path) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const download = await supabase.storage.from(bucket).download(path);
    if (download.error) throw download.error;
    const bytes = await download.data.arrayBuffer();
    const fileName = formatGuardianConsentFileName({ eventTitle: event.title || '', rsvpId: rsvp.id });

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName.ascii}"; filename*=UTF-8''${encodeURIComponent(fileName.utf8)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await guardPublicPostNoBody(req, { keyPrefix: 'rsvp_guardian_consent_upload', windowMs: 60_000, max: 10 });
  if (!guard.ok) return guard.response;

  try {
    const form = await req.formData();
    const token = asTrimmedString(form.get('token'));
    const file = form.get('file');
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    const f = file as File;
    const contentType = String(f.type || '').toLowerCase();
    if (contentType !== 'application/pdf' && fileExt(f.name) !== 'pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }
    if (f.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large' }, { status: 400 });

    const supabase = getServerSupabase();
    const rsvp = await loadRsvpByToken(supabase, token);
    if (!rsvp?.id || !rsvp.event_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const path = `signed/${rsvp.id}/${randomUUID()}.pdf`;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const upload = await supabase.storage.from(GUARDIAN_CONSENT_BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: false });
    if (upload.error) throw upload.error;

    let update = await supabase
      .from('rsvp')
      .update({
        guardian_consent_status: 'uploaded',
        guardian_consent_uploaded_at: new Date().toISOString(),
        guardian_consent_signed_bucket: GUARDIAN_CONSENT_BUCKET,
        guardian_consent_signed_path: path,
      })
      .eq('id', String(rsvp.id));
    if (update.error && isMissingColumnError(update.error.message)) {
      return NextResponse.json({ ok: true, uploaded: true, storagePath: path });
    }
    if (update.error) throw update.error;

    return NextResponse.json({ ok: true, uploaded: true, storagePath: path });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}
