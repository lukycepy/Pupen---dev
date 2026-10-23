import { z } from 'zod';

export const PageBlockRichTextSchema = z.object({
  id: z.string().min(1),
  type: z.literal('rich_text'),
  html: z.string(),
});

export const PageBlockImageSchema = z.object({
  id: z.string().min(1),
  type: z.literal('image'),
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const PageBlockDividerSchema = z.object({
  id: z.string().min(1),
  type: z.literal('divider'),
});

export const PageBlockCtaSchema = z.object({
  id: z.string().min(1),
  type: z.literal('cta'),
  title: z.string().optional(),
  body: z.string().optional(),
  primary_label: z.string().optional(),
  primary_href: z.string().optional(),
  secondary_label: z.string().optional(),
  secondary_href: z.string().optional(),
});

export const PageBlockSchema = z.discriminatedUnion('type', [
  PageBlockRichTextSchema,
  PageBlockImageSchema,
  PageBlockDividerSchema,
  PageBlockCtaSchema,
]);

export const PageBlocksSchema = z.array(PageBlockSchema).max(200);

export type PageBlock = z.infer<typeof PageBlockSchema>;
export type PageBlocks = z.infer<typeof PageBlocksSchema>;

export function parsePageBlocks(input: unknown): PageBlocks | null {
  if (input == null) return null;
  const res = PageBlocksSchema.safeParse(input);
  return res.success ? res.data : null;
}

export function pageBlocksToHtml(blocks: PageBlocks): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === 'rich_text') {
      if (String(b.html || '').trim()) out.push(String(b.html));
      continue;
    }
    if (b.type === 'image') {
      const url = String(b.url || '').trim();
      if (!url) continue;
      const alt = b.alt ? escapeAttr(String(b.alt)) : '';
      const caption = b.caption ? String(b.caption) : '';
      out.push(
        `<figure><img src="${escapeAttr(url)}" alt="${alt}"/>${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`,
      );
      continue;
    }
    if (b.type === 'divider') {
      out.push('<hr/>');
      continue;
    }
    if (b.type === 'cta') {
      const title = String(b.title || '').trim();
      const body = String(b.body || '').trim();
      const primaryLabel = String(b.primary_label || '').trim();
      const primaryHref = String(b.primary_href || '').trim();
      const secondaryLabel = String(b.secondary_label || '').trim();
      const secondaryHref = String(b.secondary_href || '').trim();
      const buttons: string[] = [];
      if (primaryLabel && primaryHref) buttons.push(`<a href="${escapeAttr(primaryHref)}">${escapeHtml(primaryLabel)}</a>`);
      if (secondaryLabel && secondaryHref) buttons.push(`<a href="${escapeAttr(secondaryHref)}">${escapeHtml(secondaryLabel)}</a>`);
      out.push(
        `<section>${title ? `<h2>${escapeHtml(title)}</h2>` : ''}${body ? `<p>${escapeHtml(body)}</p>` : ''}${buttons.length ? `<p>${buttons.join(' ')}</p>` : ''}</section>`,
      );
      continue;
    }
  }
  return out.join('\n');
}

function escapeAttr(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

