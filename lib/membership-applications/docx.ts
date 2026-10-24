import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
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

interface DocxCopy {
  title: string;
  subtitle: string;
  association: string;
  associationMeta: string;
  membershipTitle: string;
  membershipRegular: string;
  membershipRegularDesc: string;
  membershipExternal: string;
  membershipExternalDesc: string;
  labelFirstName: string;
  labelLastName: string;
  labelUniversityEmail: string;
  labelFieldYear: string;
  labelEmail: string;
  labelPhone: string;
  statementTitle: string;
  statementBody: string;
  statementContact: string;
  statementFee: string;
  placePrefix: string;
  placeValue: string;
  dateLabel: string;
  applicantSignatureLabel: string;
  decisionTitle: string;
  decisionPending: string;
  gdprTitle: string;
  gdprSubtitle: string;
  gdprIntro: string;
  gdprItems: string[];
  gdprPurpose: string;
  gdprRetention: string;
  gdprProcessors: string[];
  gdprMarketing: string;
  gdprRightsTitle: string;
  gdprRights: string[];
  gdprComplaint: string;
  gdprRevoke: string;
  gdprDateLabel: string;
  gdprSignatureLabel: string;
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

function makeFieldTable(
  copy: DocxCopy,
  input: MembershipApplicationDocxInput,
  signedOn: string,
) {
  const fieldYear = [cleanText(input.fieldOfStudy), cleanText(input.studyYear)]
    .filter(Boolean)
    .join(', ');

  const rows = [
    [copy.labelFirstName, cleanText(input.firstName, '-')],
    [copy.labelLastName, cleanText(input.lastName, '-')],
    [
      copy.labelUniversityEmail,
      input.membershipType === 'regular' ? cleanText(input.universityEmail, '-') : '-',
    ],
    [copy.labelFieldYear, input.membershipType === 'regular' ? cleanText(fieldYear, '-') : '-'],
    [copy.labelEmail, cleanText(input.email, '-')],
    [copy.labelPhone, cleanText(input.phone, '-')],
    [copy.dateLabel, cleanText(signedOn, '-')],
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            borders: {
              bottom: { style: BorderStyle.SINGLE, color: '000000', size: 1 },
            },
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 72, type: WidthType.PERCENTAGE },
            borders: {
              bottom: { style: BorderStyle.SINGLE, color: '000000', size: 1 },
            },
            children: [
              new Paragraph({
                children: [new TextRun(String(value || '-'))],
              }),
            ],
          }),
        ],
      }),
    ),
  });
}

function getCopy(lang: ApplicationLang): DocxCopy {
  if (lang === 'en') {
    return {
      title: 'MEMBERSHIP APPLICATION',
      subtitle: 'The application includes consent to the processing of personal data for the member register.',
      association: 'Studentský spolek Pupen, z.s.',
      associationMeta:
        'Company ID: 22694498, registered with the Municipal Court in Prague, file No. L 18291, registered office Kamýcká 129, Suchdol, 165 00 Prague.',
      membershipTitle: 'Membership type',
      membershipRegular: 'REGULAR',
      membershipRegularDesc:
        'for students enrolled at FAPPZ, Czech University of Life Sciences Prague, in bachelor, master or doctoral studies',
      membershipExternal: 'EXTERNAL',
      membershipExternalDesc:
        'for students of other CZU faculties and institutes (corresponding member) and FAPPZ graduates (alumni member)',
      labelFirstName: 'First name',
      labelLastName: 'Last name',
      labelUniversityEmail: 'University email',
      labelFieldYear: 'Field of study, year',
      labelEmail: 'Email',
      labelPhone: 'Phone',
      statementTitle: 'Applicant statement',
      statementBody:
        'By submitting this application, I confirm that I wish to become a member of Studentský spolek Pupen, z.s., that I have read the statutes and agree with them. I understand that the application may be submitted in written or electronic form and that, if my membership is established, I will comply with the rights and obligations arising from membership.',
      statementContact:
        'Electronic applications are delivered to info@pupen.org.',
      statementFee: 'I undertake to pay the membership fee of CZK 200 per semester.',
      placePrefix: 'In',
      placeValue: 'Prague',
      dateLabel: 'Date',
      applicantSignatureLabel: 'Applicant signature',
      decisionTitle: 'Association decision',
      decisionPending: 'To be completed by the association after review.',
      gdprTitle: 'Consent to the processing of personal data',
      gdprSubtitle: 'Attachment to the membership application',
      gdprIntro:
        'I hereby grant consent to Studentský spolek Pupen, z.s. to process the personal data I have provided for the purposes of keeping the member register, communicating association activities and fulfilling the legitimate activities of the association.',
      gdprItems: [
        'first name and last name',
        'delivery email address',
        'phone contact',
        'year of membership and any role carried out in the association',
        'photographs from association events',
        'field and year of study',
        'other data necessary for the association operation',
      ],
      gdprPurpose:
        'The data are processed for membership administration, communication about association activities, scholarships, events, promotion of the association and related operational agenda.',
      gdprRetention:
        'The data are retained for the duration of membership and no longer than 3 years after membership ends, unless a legal obligation requires a longer retention period.',
      gdprProcessors: [
        'Czech University of Life Sciences Prague for scholarship administration',
        'public authorities where required for grants or statutory obligations',
      ],
      gdprMarketing:
        'I also acknowledge that the association may process my name, photographs, videos and audio recordings for marketing and presentation purposes if I have provided or allowed them.',
      gdprRightsTitle: 'Under the GDPR, I acknowledge my rights to:',
      gdprRights: [
        'access my personal data',
        'rectify inaccurate or incomplete data',
        'erase data where legal conditions are met',
        'restrict processing',
        'data portability',
        'object to processing',
        'not be subject solely to automated decision-making where prohibited',
        'be notified of a personal data breach where required by law',
      ],
      gdprComplaint:
        'For GDPR matters, contact gdpr@pupen.org. You may also lodge a complaint with the Czech Data Protection Authority (www.uoou.cz).',
      gdprRevoke:
        'This consent can be withdrawn at any time in writing or electronically by sending a request to gdpr@pupen.org.',
      gdprDateLabel: 'Date',
      gdprSignatureLabel: 'Signature',
    };
  }

  return {
    title: 'PŘIHLÁŠKA DO SPOLKU',
    subtitle:
      'Součástí přihlášky je Souhlas se zpracováním osobních údajů v rámci seznamu členů spolku.',
    association: 'Studentský spolek Pupen, z.s.',
    associationMeta:
      'IČO: 22694498, zapsaný u Městského soudu v Praze, spisová značka L 18291, sídlem Kamýcká 129, Suchdol, 165 00 Praha.',
    membershipTitle: 'Typ členství',
    membershipRegular: 'ŘÁDNÉ',
    membershipRegularDesc:
      'pro studenty studující na FAPPZ ČZU v Praze bakalářské, magisterské nebo doktorské studium',
    membershipExternal: 'EXTERNÍ',
    membershipExternalDesc:
      'pro studenty jiných fakult a institutů ČZU v Praze a absolventy FAPPZ ČZU',
    labelFirstName: 'Jméno',
    labelLastName: 'Příjmení',
    labelUniversityEmail: 'Univerzitní email',
    labelFieldYear: 'Obor, ročník',
    labelEmail: 'Email',
    labelPhone: 'Telefon',
    statementTitle: 'Prohlášení žadatele',
    statementBody:
      'Svým podpisem stvrzuji, že se chci stát členem spolku Studentský spolek Pupen, z.s., že jsem se seznámil/a se stanovami a souhlasím s nimi. Beru na vědomí, že přihláška se podává v písemné nebo elektronické formě a že v případě vzniku mého členství budu plnit veškerá práva a povinnosti člena spolku.',
    statementContact:
      'Elektronicky se přihláška podává na e-mailovou adresu info@pupen.org.',
    statementFee: 'Zavazuji se uhradit členský příspěvek 200 Kč za semestr.',
    placePrefix: 'V',
    placeValue: 'Praze',
    dateLabel: 'Datum',
    applicantSignatureLabel: 'Podpis žadatele',
    decisionTitle: 'Rozhodnutí spolku o členství',
    decisionPending: 'Vyplní spolek po posouzení přihlášky.',
    gdprTitle: 'Souhlas se zpracováním osobních údajů',
    gdprSubtitle: 'Příloha přihlášky do spolku',
    gdprIntro:
      'Já níže podepsaný/á tímto uděluji souhlas pro Studentský spolek Pupen, z.s., aby zpracovával moje osobní údaje, které jsem poskytl/a, za účelem vedení evidence členské základny, komunikace o činnosti spolku a zajištění provozu spolku.',
    gdprItems: [
      'jméno a příjmení',
      'elektronická doručovací adresa',
      'telefonní kontakt',
      'rok vzniku členství a typ vykonávané funkce ve spolku',
      'fotografie z akcí spolku',
      'ročník a obor studia',
      'další údaje nezbytné pro chod spolku',
    ],
    gdprPurpose:
      'Osobní údaje jsou zpracovávány za účelem vedení evidence členské základny, informací o činnosti spolku, plnění účelu, pro který byl spolek založen, a souvisejících činností.',
    gdprRetention:
      'Osobní údaje jsou uchovávány po dobu členství a nejdéle po dobu 3 let ode dne, kdy přestanu být členem spolku, pokud právní předpis nevyžaduje delší dobu.',
    gdprProcessors: [
      'Česká zemědělská univerzita v Praze za účelem výplaty stipendií',
      'příslušné orgány státní správy a samosprávy za účelem žádostí o dotace nebo splnění zákonných povinností',
    ],
    gdprMarketing:
      'Beru na vědomí, že spolek může na základě souhlasu zpracovávat moje jméno, fotografie, videa a zvukové záznamy pro marketing a prezentaci činnosti spolku.',
    gdprRightsTitle: 'Podle GDPR beru na vědomí své právo na:',
    gdprRights: [
      'přístup k osobním údajům',
      'opravu nepřesných nebo neúplných údajů',
      'výmaz údajů za podmínek GDPR',
      'omezení zpracování',
      'přenositelnost údajů',
      'vznesení námitky proti zpracování',
      'nepodrobení se výhradně automatizovanému rozhodování, pokud je zakázáno',
      'oznámení případu porušení zabezpečení osobních údajů, pokud to zákon vyžaduje',
    ],
    gdprComplaint:
      'V případě pochybností o zpracování osobních údajů můžete kontaktovat gdpr@pupen.org a podat stížnost k Úřadu pro ochranu osobních údajů (www.uoou.cz).',
    gdprRevoke:
      'Souhlas lze kdykoliv odvolat písemně nebo elektronicky zasláním žádosti na gdpr@pupen.org.',
    gdprDateLabel: 'Datum',
    gdprSignatureLabel: 'Podpis',
  };
}

function sectionHeading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text,
        bold: true,
      }),
    ],
  });
}

function bodyParagraph(text: string, opts?: { bold?: boolean; italics?: boolean; pageBreakBefore?: boolean }) {
  return new Paragraph({
    pageBreakBefore: opts?.pageBreakBefore === true,
    spacing: { after: 140 },
    alignment: AlignmentType.BOTH,
    children: [
      new TextRun({
        text,
        bold: opts?.bold === true,
        italics: opts?.italics === true,
      }),
    ],
  });
}

function bulletList(items: string[]) {
  return items.map((item) =>
    new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 60 },
      children: [new TextRun(item)],
    }),
  );
}

function signatureParagraph(label: string, image: ImageInput | null) {
  if (!image) {
    return new Paragraph({
      spacing: { before: 160, after: 100 },
      children: [new TextRun(`${label}: ______________________________`)],
    });
  }

  return new Paragraph({
    spacing: { before: 160, after: 100 },
    children: [
      new TextRun({ text: `${label}: ` }),
      new ImageRun({
        data: image.bytes,
        transformation: { width: 220, height: 70 },
        type: image.extension,
      }),
    ],
  });
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
  const lang = input.lang === 'en' ? 'en' : 'cs';
  const copy = getCopy(lang);
  const signedOn = formatSignedOn(input.signedOn, lang);
  const applicantSignature = decodeImageDataUrl(input.applicantSignature);
  const regularChecked = input.membershipType === 'regular' ? '☒' : '☐';
  const externalChecked = input.membershipType === 'external' ? '☒' : '☐';

  const doc = new Document({
    creator: 'Pupen',
    title: copy.title,
    description: `${copy.title} · ${MEMBERSHIP_APPLICATION_DOCX_TEMPLATE_PATH}`,
    sections: [
      {
        children: [
          sectionHeading(copy.title),
          bodyParagraph(copy.subtitle, { italics: true }),
          bodyParagraph(copy.association, { bold: true }),
          bodyParagraph(copy.associationMeta),
          sectionHeading(copy.membershipTitle, HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    children: [new Paragraph(`${regularChecked} ${copy.membershipRegular}`)],
                  }),
                  new TableCell({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    children: [new Paragraph(copy.membershipRegularDesc)],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    children: [new Paragraph(`${externalChecked} ${copy.membershipExternal}`)],
                  }),
                  new TableCell({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    children: [new Paragraph(copy.membershipExternalDesc)],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 160 } }),
          makeFieldTable(copy, input, signedOn),
          new Paragraph({ spacing: { after: 180 } }),
          sectionHeading(copy.statementTitle, HeadingLevel.HEADING_2),
          bodyParagraph(copy.statementBody),
          bodyParagraph(copy.statementContact),
          bodyParagraph(copy.statementFee, { bold: true }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 35, type: WidthType.PERCENTAGE },
                    borders: { bottom: { style: BorderStyle.SINGLE, color: '000000', size: 1 } },
                    children: [new Paragraph(`${copy.placePrefix} ${copy.placeValue}`)],
                  }),
                  new TableCell({
                    width: { size: 65, type: WidthType.PERCENTAGE },
                    borders: { bottom: { style: BorderStyle.SINGLE, color: '000000', size: 1 } },
                    children: [new Paragraph(`${copy.dateLabel}: ${signedOn}`)],
                  }),
                ],
              }),
            ],
          }),
          signatureParagraph(copy.applicantSignatureLabel, applicantSignature),
          sectionHeading(copy.decisionTitle, HeadingLevel.HEADING_2),
          bodyParagraph(copy.decisionPending),
        ],
      },
      {
        children: [
          sectionHeading(copy.gdprTitle),
          bodyParagraph(copy.gdprSubtitle, { italics: true }),
          bodyParagraph(copy.gdprIntro),
          ...bulletList(copy.gdprItems),
          bodyParagraph(copy.gdprPurpose),
          bodyParagraph(copy.gdprRetention),
          sectionHeading(lang === 'en' ? 'Processors' : 'Zpracovatelé', HeadingLevel.HEADING_2),
          ...bulletList(copy.gdprProcessors),
          bodyParagraph(copy.gdprMarketing),
          sectionHeading(copy.gdprRightsTitle, HeadingLevel.HEADING_2),
          ...bulletList(copy.gdprRights),
          bodyParagraph(copy.gdprComplaint),
          bodyParagraph(copy.gdprRevoke),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 35, type: WidthType.PERCENTAGE },
                    borders: { bottom: { style: BorderStyle.SINGLE, color: '000000', size: 1 } },
                    children: [new Paragraph(`${copy.placePrefix} ${copy.placeValue}`)],
                  }),
                  new TableCell({
                    width: { size: 65, type: WidthType.PERCENTAGE },
                    borders: { bottom: { style: BorderStyle.SINGLE, color: '000000', size: 1 } },
                    children: [new Paragraph(`${copy.gdprDateLabel}: ${signedOn}`)],
                  }),
                ],
              }),
            ],
          }),
          signatureParagraph(copy.gdprSignatureLabel, applicantSignature),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
