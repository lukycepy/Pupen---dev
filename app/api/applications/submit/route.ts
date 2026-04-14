import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { applicationSubmitSchema } from '@/lib/validations/application';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'applications:submit',
      windowMs: 60_000,
      max: 10,
      honeypotResponse: { ok: true },
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to prosím později.',
    });
    if (!g.ok) return g.response;
    const body = g.body;

    const parseResult = applicationSubmitSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const data = parseResult.data;
    if (!data.gdpr_consent) return NextResponse.json({ error: 'Je nutný souhlas se zpracováním osobních údajů.' }, { status: 400 });

    const full_name = `${data.first_name} ${data.last_name}`.trim();
    const payload: any = {
      full_name,
      name: full_name,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      address: data.address ? String(data.address).trim() : null,
      address_meta: data.address_meta || {},
      address_validated_at: data.address ? new Date().toISOString() : null,
      membership_type: data.membership_type,
      university_email: data.membership_type === 'regular' ? (data.university_email || null) : null,
      field_of_study: data.membership_type === 'regular' ? (data.field_of_study || null) : null,
      study_year: data.membership_type === 'regular' ? (data.study_year || null) : null,
      signed_on: data.signed_on || null,
      gdpr_consent: true,
      signature_data_url: data.applicant_signature,
      applicant_signature: data.applicant_signature,
      faculty: data.membership_type === 'regular' ? `${data.field_of_study || ''}, ${data.study_year || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || null : null,
      status: 'pending',
    };

    const supabase = getServerSupabase();
    const ins = await supabase.from('applications').insert([payload]).select('id').single();
    if (ins.error) throw ins.error;

    return NextResponse.json({ ok: true, applicationId: ins.data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Error') }, { status: 500 });
  }
}
