import { test, expect } from '@playwright/test';
import { renderEmailTemplate } from '@/lib/email/templates';

test('billing_invoice_sent escapes HTML in variables', async () => {
  const out = renderEmailTemplate('billing_invoice_sent', {
    toEmail: 'test@example.com',
    buyerName: '<img src=x onerror=alert(1)>',
    invoiceNumber: 'FA-2026-0001',
    vs: '20260001',
    total: '1000',
    currency: 'CZK',
    dueDate: '2026-05-23',
    pdfUrl: 'https://example.com/file.pdf',
    lang: 'cs',
  });

  expect(out.subject).toContain('Pupen');
  expect(out.html).toContain('&lt;img');
  expect(out.html).not.toContain('<img');
});

test('invoice_paid escapes script tags in variables', async () => {
  const out = renderEmailTemplate('invoice_paid', {
    toEmail: 'test@example.com',
    buyerName: '<script>alert(1)</script>',
    invoiceNumber: 'FA-2026-0001',
    vs: '20260001',
    total: '1000',
    currency: 'CZK',
    lang: 'cs',
  });

  expect(out.html).toContain('&lt;script&gt;');
  expect(out.html).not.toContain('<script>');
});

