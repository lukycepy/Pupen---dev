import { getPragueYearTwoDigits } from '@/lib/time/prague';

export function formatApplicationPdfFileName(input: { firstName?: any; lastName?: any; createdAt?: any }) {
  const first = String(input.firstName || '').trim();
  const last = String(input.lastName || '').trim();
  const yy = getPragueYearTwoDigits(input.createdAt || new Date());
  const utf8 = `${last || 'Prijmeni'}-${first || 'Jmeno'}-PUPEN-${yy}.pdf`;

  const ascii = utf8
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');

  return { utf8, ascii: ascii || `application-PUPEN-${yy}.pdf` };
}
