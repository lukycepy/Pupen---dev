import { readFile } from 'fs/promises';
import path from 'path';
import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { formatDatePrague } from '@/lib/time/prague';

export const MEMBERSHIP_APPLICATION_DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const MEMBERSHIP_APPLICATION_DOCX_TEMPLATE_PATH =
  'Ostatní/PUPEN-prihlaska-vctene-prispevku-a-GDPR.docx';

type ApplicationLang = 'cs' | 'en';

interface MembershipApplicationDocxInput {
  lang: ApplicationLang;
  membershipType: 'regular' | 'external';
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  universityEmail?: unknown;
  fieldOfStudy?: unknown;
  studyYear?: unknown;
  signedOn?: unknown;
  applicantSignature?: string | null;
}

interface ImageInput {
  bytes: Buffer;
  extension: 'png' | 'jpg';
}

function cleanText(input: unknown, fallback = '') {
  const s = String(input ?? '').replace(/\u0000/g, '').trim();
  if (!s) return fallback;
  return s.replace(/\s+/g, ' ').trim();
}

function sanitizeFileBase(input: string) {
  return String(input || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

function formatSignedOn(input: unknown, lang: ApplicationLang) {
  const explicit = cleanText(input, '');
  if (explicit) return explicit;
  const now = new Date().toISOString();
  return formatDatePrague(now, lang);
}

function decodeImageDataUrl(dataUrl: string | null | undefined): ImageInput | null {
  const s = String(dataUrl || '').trim();
  const m = s.match(/^data:image\/(png|jpeg|jpg);base64,([a-z0-9+/=\s]+)$/i);
  if (!m?.[1] || !m[2]) return null;
  const extension = String(m[1]).toLowerCase() === 'png' ? 'png' : 'jpg';
  const bytes = Buffer.from(String(m[2]).replace(/\s+/g, ''), 'base64');
  if (!bytes.length) return null;
  return { bytes, extension };
}

const WORD_XML_OPTIONS = { xmlMode: true, decodeEntities: false as const };
const W_P = 'w\\:p';
const W_T = 'w\\:t';
const W_TC = 'w\\:tc';
const W_TR = 'w\\:tr';
const W_TBL = 'w\\:tbl';
const W_PPR = 'w\\:pPr';

function resolveMembershipTemplatePath() {
  return path.resolve(process.cwd(), MEMBERSHIP_APPLICATION_DOCX_TEMPLATE_PATH);
}

function normalizeNodeText(text: string) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getNodeText($: CheerioAPI, node: AnyNode) {
  return normalizeNodeText($(node).text());
}

function escapeXmlText(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textRunXml(text: string, size: 20 | 22, opts?: { bold?: boolean }) {
  const bold = opts?.bold ? '<w:b /><w:bCs />' : '';
  return `<w:r><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" />${bold}<w:sz w:val="${size}" /><w:szCs w:val="${size}" /></w:rPr><w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r>`;
}

function tabRunXml(size: 20 | 22) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" /><w:sz w:val="${size}" /><w:szCs w:val="${size}" /></w:rPr><w:tab /></w:r>`;
}

function setParagraphInnerXml(paragraph: Cheerio<AnyNode>, innerXml: string) {
  paragraph.children().not(W_PPR).remove();
  paragraph.append(innerXml);
}

function setParagraphText(paragraph: Cheerio<AnyNode>, text: string, size: 20 | 22, opts?: { bold?: boolean }) {
  setParagraphInnerXml(paragraph, text ? textRunXml(text, size, opts) : '');
}

function findParagraphByText($: CheerioAPI, needle: string) {
  return $(W_P)
    .toArray()
    .find((node) => getNodeText($, node).includes(needle));
}

function findParagraphsByExactText($: CheerioAPI, value: string) {
  return $(W_P)
    .toArray()
    .filter((node) => getNodeText($, node) === value);
}

function fillTableValue($: CheerioAPI, label: string, value: string) {
  const table = $(W_TBL)
    .toArray()
    .find((node) => {
      const firstCell = $(node).find(W_TC).first();
      const firstCellNode = firstCell.get(0);
      return firstCellNode ? getNodeText($, firstCellNode).startsWith(label) : false;
    });
  if (!table) return;
  const valueCell = $(table).find(W_TR).first().find(W_TC).eq(1);
  const paragraph = valueCell.find(W_P).first();
  if (!paragraph.length) return;
  setParagraphText(paragraph, value, 22);
}

function replaceParagraphText($: CheerioAPI, needle: string, replacer: (text: string) => string, size: 20 | 22) {
  const paragraphNode = findParagraphByText($, needle);
  if (!paragraphNode) return;
  const paragraph = $(paragraphNode);
  const currentText = normalizeNodeText(paragraph.text());
  const nextText = replacer(currentText);
  setParagraphText(paragraph, nextText, size);
}

function buildInlineImageXml(relId: string, imageName: string, docPrId: number, widthPx: number, heightPx: number) {
  const cx = Math.round(widthPx * 9525);
  const cy = Math.round(heightPx * 9525);
  return [
    '<w:r>',
    '<w:drawing>',
    '<wp:inline distT="0" distB="0" distL="0" distR="0">',
    `<wp:extent cx="${cx}" cy="${cy}" />`,
    '<wp:effectExtent l="0" t="0" r="0" b="0" />',
    `<wp:docPr id="${docPrId}" name="${escapeXmlText(imageName)}" />`,
    '<wp:cNvGraphicFramePr>',
    '<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1" />',
    '</wp:cNvGraphicFramePr>',
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">',
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">',
    '<pic:nvPicPr>',
    `<pic:cNvPr id="${docPrId}" name="${escapeXmlText(imageName)}" />`,
    '<pic:cNvPicPr />',
    '</pic:nvPicPr>',
    '<pic:blipFill>',
    `<a:blip r:embed="${escapeXmlText(relId)}" />`,
    '<a:stretch><a:fillRect /></a:stretch>',
    '</pic:blipFill>',
    '<pic:spPr>',
    '<a:xfrm>',
    '<a:off x="0" y="0" />',
    `<a:ext cx="${cx}" cy="${cy}" />`,
    '</a:xfrm>',
    '<a:prstGeom prst="rect"><a:avLst /></a:prstGeom>',
    '</pic:spPr>',
    '</pic:pic>',
    '</a:graphicData>',
    '</a:graphic>',
    '</wp:inline>',
    '</w:drawing>',
    '</w:r>',
  ].join('');
}

function ensureImageRelationship(
  relsXml: string,
  target: string,
) {
  const $rels = load(relsXml, WORD_XML_OPTIONS);
  const existing = $rels('Relationship')
    .toArray()
    .find((node) => $rels(node).attr('Target') === target);
  if (existing) {
    return {
      relId: String($rels(existing).attr('Id') || '').trim(),
      xml: $rels.xml(),
    };
  }

  const ids = $rels('Relationship')
    .toArray()
    .map((node) => {
      const raw = String($rels(node).attr('Id') || '');
      const match = raw.match(/^rId(\d+)$/);
      return match?.[1] ? Number(match[1]) : 0;
    });
  const relId = `rId${Math.max(0, ...ids) + 1}`;
  $rels('Relationships').append(
    `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${escapeXmlText(target)}" />`,
  );
  return { relId, xml: $rels.xml() };
}

function ensureContentTypeDefault(contentTypesXml: string, extension: 'png' | 'jpg') {
  const $types = load(contentTypesXml, WORD_XML_OPTIONS);
  const normalizedExtension = extension === 'jpg' ? 'jpeg' : 'png';
  const existing = $types('Default')
    .toArray()
    .some((node) => String($types(node).attr('Extension') || '').toLowerCase() === normalizedExtension);
  if (!existing) {
    $types('Types').prepend(
      `<Default Extension="${normalizedExtension}" ContentType="${extension === 'png' ? 'image/png' : 'image/jpeg'}" />`,
    );
  }
  return $types.xml();
}

export function buildMembershipApplicationDocxStoragePath(applicationId: string, lang: ApplicationLang) {
  const id = String(applicationId || '').trim() || 'application';
  const locale = lang === 'en' ? 'en' : 'cs';
  return `membership_applications_v2/${id}/application_${locale}.docx`;
}

export function formatMembershipApplicationDocxFileName(input: {
  firstName?: unknown;
  lastName?: unknown;
  createdAt?: unknown;
  lang?: unknown;
}) {
  const first = sanitizeFileBase(cleanText(input.firstName, ''));
  const last = sanitizeFileBase(cleanText(input.lastName, ''));
  const date = String(input.createdAt || '').slice(0, 10).replace(/[^\d-]/g, '') || '';
  const locale = String(input.lang || '') === 'en' ? 'en' : 'cs';
  const base = sanitizeFileBase([first, last, locale, date].filter(Boolean).join('_')) || 'prihlaska';
  return `${base}.docx`;
}

export async function buildMembershipApplicationDocxBytes(input: MembershipApplicationDocxInput) {
  const signedOn = formatSignedOn(input.signedOn, 'cs');
  const firstName = cleanText(input.firstName, '');
  const lastName = cleanText(input.lastName, '');
  const fieldYear = [cleanText(input.fieldOfStudy, ''), cleanText(input.studyYear, '')]
    .filter(Boolean)
    .join(', ');
  const templateBytes = await readFile(resolveMembershipTemplatePath());
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(templateBytes);

  const documentEntry = zip.file('word/document.xml');
  const relsEntry = zip.file('word/_rels/document.xml.rels');
  const contentTypesEntry = zip.file('[Content_Types].xml');
  if (!documentEntry || !relsEntry || !contentTypesEntry) {
    throw new Error('Membership DOCX template is incomplete.');
  }

  const [documentXml, relsXml, contentTypesXml] = await Promise.all([
    documentEntry.async('string'),
    relsEntry.async('string'),
    contentTypesEntry.async('string'),
  ]);

  const $doc = load(documentXml, WORD_XML_OPTIONS);
  const membershipTable = $doc(W_TBL).first();
  const membershipChecks = membershipTable
    .find(W_T)
    .toArray()
    .filter((node) => $doc(node).text() === '▢');
  if (membershipChecks[0]) $doc(membershipChecks[0]).text(input.membershipType === 'regular' ? '☒' : '☐');
  if (membershipChecks[1]) $doc(membershipChecks[1]).text(input.membershipType === 'external' ? '☒' : '☐');

  fillTableValue($doc, 'Jméno', firstName);
  fillTableValue($doc, 'Příjmení', lastName);
  fillTableValue(
    $doc,
    'Univerzitní email',
    input.membershipType === 'regular' ? cleanText(input.universityEmail, '') : '',
  );
  fillTableValue(
    $doc,
    'Obor, ročník',
    input.membershipType === 'regular' ? fieldYear : '',
  );
  fillTableValue($doc, 'Email', cleanText(input.email, ''));
  fillTableValue($doc, 'Telefon', cleanText(input.phone, ''));

  const dateParagraphs = findParagraphsByExactText($doc, 'V dne').concat(findParagraphsByExactText($doc, 'V dne:'));
  if (dateParagraphs[0]) {
    setParagraphInnerXml(
      $doc(dateParagraphs[0]),
      `${textRunXml('V Praze', 22)}${tabRunXml(22)}${textRunXml(`dne ${signedOn}`, 22)}`,
    );
  }
  if (dateParagraphs[1]) {
    setParagraphInnerXml(
      $doc(dateParagraphs[1]),
      `${textRunXml('V Praze', 20)}${tabRunXml(20)}${textRunXml(`dne: ${signedOn}`, 20)}`,
    );
  }

  const consentName = `${firstName} ${lastName}`.trim();
  if (consentName) {
    replaceParagraphText(
      $doc,
      'Já níže podepsaný',
      (text) => text.replace(/Já níže podepsaný\/á\s+_+\s+_+/, `Já níže podepsaný/á ${consentName}`),
      20,
    );
  }

  const applicantEmailLink = $doc('w\\:hyperlink[r\\:id="rId10"]').first();
  if (applicantEmailLink.length) {
    applicantEmailLink.find(W_T).first().text('info@pupen.org');
  }

  replaceParagraphText(
    $doc,
    'Elektronicky lze souhlas odvolat zasláním zprávy na e-mailovou adresu',
    (text) => text.replace(/pupen@af\.czu\.cz/gi, 'gdpr@pupen.org'),
    20,
  );

  const signature = decodeImageDataUrl(input.applicantSignature);
  let nextRelsXml = relsXml;
  let nextContentTypesXml = contentTypesXml;
  if (signature) {
    const mediaFileName = `applicant-signature.${signature.extension === 'png' ? 'png' : 'jpeg'}`;
    const mediaTarget = `media/${mediaFileName}`;
    zip.file(`word/${mediaTarget}`, signature.bytes);

    const relInfo = ensureImageRelationship(nextRelsXml, mediaTarget);
    nextRelsXml = relInfo.xml;
    nextContentTypesXml = ensureContentTypeDefault(nextContentTypesXml, signature.extension);

    const dottedParagraphs = findParagraphsByExactText($doc, '……………………………………….');
    const applicantSignatureXml = `${tabRunXml(22)}${tabRunXml(22)}${buildInlineImageXml(relInfo.relId, mediaFileName, 1001, 220, 70)}`;
    const gdprSignatureXml = `${tabRunXml(20)}${tabRunXml(20)}${buildInlineImageXml(relInfo.relId, mediaFileName, 1002, 220, 70)}`;
    if (dottedParagraphs[0]) {
      setParagraphInnerXml($doc(dottedParagraphs[0]), applicantSignatureXml);
    }
    if (dottedParagraphs[1]) {
      setParagraphInnerXml($doc(dottedParagraphs[1]), gdprSignatureXml);
    }
  }

  const $rels = load(nextRelsXml, WORD_XML_OPTIONS);
  const infoMailRel = $rels('Relationship')
    .toArray()
    .find((node) => String($rels(node).attr('Id') || '').trim() === 'rId10');
  if (infoMailRel) {
    $rels(infoMailRel).attr('Target', 'mailto:info@pupen.org');
  }

  zip.file('word/document.xml', $doc.xml());
  zip.file('word/_rels/document.xml.rels', $rels.xml());
  zip.file('[Content_Types].xml', nextContentTypesXml);

  return await zip.generateAsync({
    type: 'nodebuffer',
    mimeType: MEMBERSHIP_APPLICATION_DOCX_MIME,
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
