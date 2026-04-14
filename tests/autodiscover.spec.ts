import { test, expect } from '@playwright/test';

test.describe('Outlook Autodiscover', () => {
  test('Autodiscover XML is served on /autodiscover/autodiscover.xml', async ({ request }) => {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/requestschema/2006">
  <Request>
    <EMailAddress>test@pupen.org</EMailAddress>
    <AcceptableResponseSchema>http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a</AcceptableResponseSchema>
  </Request>
</Autodiscover>`;

    const res = await request.post('/autodiscover/autodiscover.xml', {
      headers: { 'content-type': 'text/xml' },
      data: body,
    });
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('imap.pupen.org');
    expect(text).toContain('smtp.pupen.org');
    expect(text).toContain('<Type>IMAP</Type>');
    expect(text).toContain('<Type>SMTP</Type>');
  });

  test('Autodiscover XML is served on /.well-known/autodiscover/autodiscover.xml', async ({ request }) => {
    const res = await request.get('/.well-known/autodiscover/autodiscover.xml?email=test@pupen.org');
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('imap.pupen.org');
    expect(text).toContain('smtp.pupen.org');
  });

  test('Autodiscover XML is served on /Autodiscover/Autodiscover.xml', async ({ request }) => {
    const res = await request.get('/Autodiscover/Autodiscover.xml?email=test@pupen.org');
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('imap.pupen.org');
    expect(text).toContain('smtp.pupen.org');
  });
});
