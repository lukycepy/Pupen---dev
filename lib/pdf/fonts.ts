import { PDFDocument, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getPublicBaseUrl } from '@/lib/public-base-url';

async function readFontFile(relPath: string) {
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const p = path.join(process.cwd(), relPath);
    const buf = await fs.readFile(p);
    return new Uint8Array(buf);
  } catch {
    const base = getPublicBaseUrl();
    const url = `${base}/${relPath.replace(/^\/+/, '')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }
}

export async function getPdfFonts(pdfDoc: PDFDocument) {
  try {
    pdfDoc.registerFontkit(fontkit as any);
    const regularBytes = await readFontFile('public/fonts/noto-sans/NotoSans-Regular.ttf');
    const boldBytes = await readFontFile('public/fonts/noto-sans/NotoSans-Bold.ttf');
    const font = await pdfDoc.embedFont(regularBytes, { subset: true });
    const fontBold = await pdfDoc.embedFont(boldBytes, { subset: true });
    return { font, fontBold, usedEmbedded: true as const };
  } catch {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    return { font, fontBold, usedEmbedded: false as const };
  }
}
