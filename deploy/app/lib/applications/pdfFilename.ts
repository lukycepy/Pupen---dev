import { getPragueYearTwoDigits } from '@/lib/time/prague';

export function formatApplicationPdfFileName(input: { firstName?: any; lastName?: any; createdAt?: any }) {
  const first = String(input.firstName || '').trim();
  const last = String(input.lastName || '').trim();
  const yy = getPragueYearTwoDigits(input.createdAt || new Date());

  const sanitize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/(^_|_$)/g, '');

  const firstSafe = sanitize(first || 'Jmeno');
  const lastSafe = sanitize(last || 'Prijmeni');
  const base = `${lastSafe}_${firstSafe}-Pupen_${yy}`;
  const utf8 = `${base}.pdf`;
  const ascii = `${base}.pdf`;

  return { utf8, ascii: ascii || `Prijmeni_Jmeno-Pupen_${yy}.pdf` };
}
