import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { PageBlocks } from '@/lib/site/page-blocks';

export default function PageBlocksRenderer({ blocks }: { blocks: PageBlocks }) {
  const isInternalHref = (href: string) => href.startsWith('/');

  return (
    <div className="space-y-10">
      {blocks.map((b) => {
        if (b.type === 'rich_text') {
          const html = String(b.html || '').trim();
          if (!html) return null;
          return <div key={b.id} className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
        }
        if (b.type === 'image') {
          return (
            <figure key={b.id} className="space-y-3">
              <Image
                src={b.url}
                alt={String(b.alt || '')}
                width={1600}
                height={900}
                sizes="(min-width: 1024px) 1024px, 100vw"
                className="h-auto w-full rounded-2xl border border-stone-200 bg-white object-cover"
              />
              {b.caption ? <figcaption className="text-sm font-medium text-stone-500">{b.caption}</figcaption> : null}
            </figure>
          );
        }
        if (b.type === 'divider') {
          return <hr key={b.id} className="border-stone-200" />;
        }
        if (b.type === 'cta') {
          const title = String(b.title || '').trim();
          const body = String(b.body || '').trim();
          const primaryLabel = String(b.primary_label || '').trim();
          const primaryHref = String(b.primary_href || '').trim();
          const secondaryLabel = String(b.secondary_label || '').trim();
          const secondaryHref = String(b.secondary_href || '').trim();
          return (
            <section key={b.id} className="rounded-[2rem] border border-stone-200 bg-stone-50 p-8 md:p-10">
              {title ? <h2 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">{title}</h2> : null}
              {body ? <p className="mt-3 text-stone-600 font-medium leading-relaxed">{body}</p> : null}
              {(primaryLabel && primaryHref) || (secondaryLabel && secondaryHref) ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  {primaryLabel && primaryHref ? (
                    isInternalHref(primaryHref) ? (
                      <Link
                        href={primaryHref}
                        className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-[11px] font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 transition"
                      >
                        {primaryLabel}
                      </Link>
                    ) : (
                      <a
                        href={primaryHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-[11px] font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 transition"
                      >
                        {primaryLabel}
                      </a>
                    )
                  ) : null}
                  {secondaryLabel && secondaryHref ? (
                    isInternalHref(secondaryHref) ? (
                      <Link
                        href={secondaryHref}
                        className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-[11px] font-black uppercase tracking-widest bg-white text-stone-800 border border-stone-200 hover:bg-stone-100 transition"
                      >
                        {secondaryLabel}
                      </Link>
                    ) : (
                      <a
                        href={secondaryHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-[11px] font-black uppercase tracking-widest bg-white text-stone-800 border border-stone-200 hover:bg-stone-100 transition"
                      >
                        {secondaryLabel}
                      </a>
                    )
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}
