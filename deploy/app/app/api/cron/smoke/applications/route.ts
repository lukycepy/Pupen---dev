import { NextResponse } from 'next/server';
import { buildApplicationPdfBytes } from '@/lib/applications/pdf';
import { formatApplicationPdfFileName } from '@/lib/applications/pdfFilename';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const createdAt = new Date().toISOString();
  const sampleApp: any = {
    id: '00000000-0000-0000-0000-000000000000',
    created_at: createdAt,
    first_name: 'Jan',
    last_name: 'Novák',
    name: 'Jan Novák',
    full_name: 'Jan Novák',
    email: 'jan.novak@example.com',
    phone: '+420 777 000 000',
    address: 'Kamýcká 129, 165 00 Praha',
    membership_type: 'regular',
    decision_membership_type: 'regular',
    gdpr_consent: true,
    status: 'pending',
    signed_on: createdAt.slice(0, 10),
    applicant_signature: '',
    chairwoman_signature: '',
  };

  const pdf = await buildApplicationPdfBytes(sampleApp);
  const pdfHeader = Buffer.isBuffer(pdf) ? pdf.subarray(0, 4).toString('utf8') : '';
  const { utf8, ascii } = formatApplicationPdfFileName({ firstName: sampleApp.first_name, lastName: sampleApp.last_name, createdAt });

  const tplReceived = await renderEmailTemplateWithDbOverride('application_received', {
    lang: 'cs',
    firstName: sampleApp.first_name,
    lastName: sampleApp.last_name,
    toEmail: sampleApp.email,
    adminLink: 'https://pupen.org/cs/admin/dashboard?tab=applications',
  });
  const tplAdmin = await renderEmailTemplateWithDbOverride('application_new_admin', {
    lang: 'cs',
    firstName: sampleApp.first_name,
    lastName: sampleApp.last_name,
    toEmail: sampleApp.email,
    membershipType: 'Řádné',
    adminLink: 'https://pupen.org/cs/admin/dashboard?tab=applications',
  });
  const tplApproved = await renderEmailTemplateWithDbOverride('application_approved_access', {
    lang: 'cs',
    firstName: sampleApp.first_name,
    toEmail: sampleApp.email,
    actionUrl: 'https://pupen.org/cs/reset-password#example',
    pdfUrl: 'https://pupen.org/api/applications/pdf?t=example',
  });

  return NextResponse.json({
    ok: true,
    pdf: {
      bytes: Buffer.isBuffer(pdf) ? pdf.length : 0,
      startsWith: pdfHeader,
    },
    filename: { utf8, ascii },
    templates: {
      received: { subject: tplReceived.subject, htmlBytes: Buffer.byteLength(tplReceived.html || '', 'utf8') },
      admin: { subject: tplAdmin.subject, htmlBytes: Buffer.byteLength(tplAdmin.html || '', 'utf8') },
      approved: { subject: tplApproved.subject, htmlBytes: Buffer.byteLength(tplApproved.html || '', 'utf8') },
    },
  });
}
