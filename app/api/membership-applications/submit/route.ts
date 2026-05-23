import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { getServerSupabase } from '@/lib/supabase-server';
import { applicationSubmitSchema } from '@/lib/validations/application';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';
import { enqueueEmailTrigger } from '@/lib/email/triggers';
import { getApplicationNewNotificationEmailsFromSettings, getApplicationNotificationEmailsFromSettings } from '@/lib/email/mailer';
import { writeAuditLog } from '@/lib/audit/audit-log';

export const runtime = 'nodejs';

function decodePngDataUrl(dataUrl: string): Buffer {
  const s = String(dataUrl || '').trim();
  const m = s.match(/^data:image\/png;base64,([a-z0-9+/=\s]+)$/i);
  if (!m?.[1]) throw new Error('Invalid signature');
  const b = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
  if (!b.length) throw new Error('Invalid signature');
  return b;
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'membership_applications_v2:submit',
      windowMs: 60_000,
      max: 10,
      honeypotResponse: { ok: true },
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to prosím později.',
    });
    if (!g.ok) return g.response;

    const parseResult = applicationSubmitSchema.safeParse(g.body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: parseResult.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const data = parseResult.data;
    const lang = data.lang === 'en' ? 'en' : 'cs';
    if (!data.gdpr_consent) {
      return NextResponse.json({ ok: false, error: lang === 'en' ? 'Consent is required.' : 'Je nutný souhlas.' }, { status: 400 });
    }

    const signatureBytes = decodePngDataUrl(data.applicant_signature);
    if (signatureBytes.length > 800_000) {
      return NextResponse.json({ ok: false, error: lang === 'en' ? 'Signature is too large.' : 'Podpis je příliš velký.' }, { status: 413 });
    }

    const applicationId = randomUUID();
    if (!isUuid(applicationId)) throw new Error('Invalid ID');

    const storageBucket = 'member_applications';
    const storagePath = `membership_applications_v2/${applicationId}/applicant_signature.png`;

    const supabase = getServerSupabase();
    const up = await supabase.storage.from(storageBucket).upload(storagePath, signatureBytes, {
      contentType: 'image/png',
      upsert: false,
    });
    if (up.error) throw up.error;

    const fullName = `${data.first_name} ${data.last_name}`.trim();
    const faculty =
      data.membership_type === 'regular'
        ? String(data.field_of_study || '').trim() || null
        : null;

    const meta: any = {
      lang,
      membership_type: data.membership_type,
      first_name: data.first_name,
      last_name: data.last_name,
      university_email: data.membership_type === 'regular' ? (data.university_email || null) : null,
      field_of_study: data.membership_type === 'regular' ? (data.field_of_study || null) : null,
      study_year: data.membership_type === 'regular' ? (data.study_year || null) : null,
      signed_on: data.signed_on || null,
      gdpr_consent: true,
      address_meta: data.address_meta || {},
      signature_file: {
        bucket: storageBucket,
        path: storagePath,
      },
    };

    const ins = await withSchemaCacheRetry(supabase, async () => {
      return await supabase
        .from('membership_applications_v2')
        .insert([
          {
            id: applicationId,
            name: fullName,
            email: data.email,
            phone: data.phone,
            faculty,
            address: data.address ? String(data.address).trim() : null,
            status: 'pending',
            signature_data_url: null,
            meta,
          },
        ])
        .select('id')
        .single();
    });
    if (ins.error) throw ins.error;

    const insFile = await withSchemaCacheRetry(supabase, async () => {
      return await supabase.from('membership_application_files').insert([
        {
          application_id: applicationId,
          storage_bucket: storageBucket,
          storage_path: storagePath,
          file_name: 'applicant_signature.png',
          mime_type: 'image/png',
          size_bytes: signatureBytes.length,
          meta: { kind: 'applicant_signature' },
        },
      ]);
    });
    if (insFile.error) throw insFile.error;

    const applicantEmail = String(data.email || '').trim().toLowerCase();
    await writeAuditLog({
      req,
      actorUserId: null,
      actorEmail: applicantEmail || null,
      action: 'membership_application.submit',
      entity: { type: 'membership_application', id: applicationId },
      before: null,
      after: {
        id: applicationId,
        status: 'pending',
        membership_type: data.membership_type,
        email: applicantEmail || null,
        name: fullName,
      },
      details: { bucket: storageBucket, signature_path: storagePath },
    });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';
    const adminLink = `${baseUrl}/${lang}/admin/dashboard#applications`;

    if (applicantEmail && applicantEmail.includes('@')) {
      await enqueueEmailTrigger({
        triggerKey: 'membership_application_received',
        toEmail: applicantEmail,
        lang,
        vars: {
          toEmail: applicantEmail,
          firstName: data.first_name,
          lastName: data.last_name,
        },
        headers: { 'X-Pupen-Category': 'membership', 'X-Pupen-Trigger': 'membership_application_received' },
        meta: { application_id: applicationId },
        supabase,
      });
    }

    let adminRecipients: string[] = [];
    const configuredNew = await getApplicationNewNotificationEmailsFromSettings().catch(() => []);
    const cleanedNew = Array.isArray(configuredNew) ? configuredNew.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
    if (cleanedNew.length) adminRecipients = cleanedNew;
    if (!adminRecipients.length) {
      const configuredLegacy = await getApplicationNotificationEmailsFromSettings().catch(() => []);
      const cleanedLegacy = Array.isArray(configuredLegacy) ? configuredLegacy.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
      if (cleanedLegacy.length) adminRecipients = cleanedLegacy;
    }
    if (!adminRecipients.length) {
      const { data: profs } = await supabase.from('profiles').select('email').or('is_admin.eq.true,can_manage_admins.eq.true').limit(200);
      adminRecipients = (Array.isArray(profs) ? profs : []).map((r: any) => String(r?.email || '').trim().toLowerCase()).filter(Boolean);
    }

    if (adminRecipients.length) {
      await enqueueEmailTrigger({
        triggerKey: 'membership_application_new_admin',
        toEmail: adminRecipients.join(','),
        lang,
        vars: {
          toEmail: adminRecipients.join(','),
          firstName: data.first_name,
          lastName: data.last_name,
          membershipType: data.membership_type,
          adminLink,
        },
        headers: { 'X-Pupen-Category': 'membership', 'X-Pupen-Trigger': 'membership_application_new_admin' },
        meta: { application_id: applicationId },
        supabase,
      });
    }

    return NextResponse.json({ ok: true, applicationId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || 'Error') }, { status: 500 });
  }
}
