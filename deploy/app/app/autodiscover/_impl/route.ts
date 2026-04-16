import { NextResponse } from 'next/server';

function extractEmail(body: string) {
  const m = body.match(/<\s*EMailAddress\s*>\s*([^<\s]+)\s*<\s*\/\s*EMailAddress\s*>/i);
  if (m?.[1]) return String(m[1]).trim();
  return '';
}

function buildXml(email: string) {
  const safeEmail = email.replace(/[^a-zA-Z0-9@._+-]/g, '');
  const imapHost = 'imap.pupen.org';
  const smtpHost = 'smtp.pupen.org';

  return `<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
  <Response xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a">
    <Account>
      <AccountType>email</AccountType>
      <Action>settings</Action>
      <Protocol>
        <Type>IMAP</Type>
        <Server>${imapHost}</Server>
        <Port>993</Port>
        <DomainRequired>off</DomainRequired>
        <LoginName>${safeEmail}</LoginName>
        <SPA>off</SPA>
        <SSL>on</SSL>
        <AuthRequired>on</AuthRequired>
      </Protocol>
      <Protocol>
        <Type>SMTP</Type>
        <Server>${smtpHost}</Server>
        <Port>587</Port>
        <DomainRequired>off</DomainRequired>
        <LoginName>${safeEmail}</LoginName>
        <SPA>off</SPA>
        <SSL>on</SSL>
        <AuthRequired>on</AuthRequired>
        <UsePOPAuth>off</UsePOPAuth>
        <SMTPLast>on</SMTPLast>
      </Protocol>
    </Account>
  </Response>
</Autodiscover>`;
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const contentType = String(req.headers.get('content-type') || '').toLowerCase();
  let email = String(url.searchParams.get('email') || '').trim();

  if (!email && contentType.includes('xml')) {
    const body = await req.text();
    email = extractEmail(body);
  }

  const out = buildXml(email || 'user@pupen.org');
  return new NextResponse(out, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

