import React from 'react';
import PageBlocksRenderer from '@/app/[lang]/components/PageBlocksRenderer';
import { parsePageBlocks } from '@/lib/site/page-blocks';

export default function DbContentPage({ title, html, blocks }: { title?: string | null; html?: string | null; blocks?: unknown }) {
  const t = String(title || '').trim();
  const body = String(html || '').trim();
  const parsedBlocks = parsePageBlocks(blocks);

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-white rounded-[3rem] border border-stone-100 shadow-sm p-10 md:p-14">
          {t ? <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight mb-8">{t}</h1> : null}
          {parsedBlocks?.length ? <PageBlocksRenderer blocks={parsedBlocks} /> : body ? <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: body }} /> : null}
        </div>
      </div>
    </div>
  );
}
