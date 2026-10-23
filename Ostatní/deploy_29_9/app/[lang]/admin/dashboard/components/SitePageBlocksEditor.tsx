'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import PageBlocksRenderer from '@/app/[lang]/components/PageBlocksRenderer';
import { pageBlocksToHtml, type PageBlock, type PageBlocks } from '@/lib/site/page-blocks';

const Editor = dynamic(() => import('../../../components/Editor'), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200" />,
});

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function moveItem<T>(arr: T[], from: number, to: number) {
  const next = [...arr];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it as T);
  return next;
}

export default function SitePageBlocksEditor({
  blocks,
  onChange,
  disabled,
}: {
  blocks: PageBlocks;
  onChange: (next: PageBlocks) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState(false);

  const htmlPreview = useMemo(() => pageBlocksToHtml(blocks), [blocks]);

  const addBlock = (b: PageBlock) => onChange([...(blocks || []), b]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => addBlock({ id: newId(), type: 'rich_text', html: '' })}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 disabled:opacity-50"
          >
            <Plus size={16} />
            Text
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => addBlock({ id: newId(), type: 'image', url: 'https://', alt: '', caption: '' })}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 disabled:opacity-50"
          >
            <Plus size={16} />
            Obrázek
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => addBlock({ id: newId(), type: 'divider' })}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 disabled:opacity-50"
          >
            <Plus size={16} />
            Oddělovač
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              addBlock({
                id: newId(),
                type: 'cta',
                title: '',
                body: '',
                primary_label: '',
                primary_href: '',
                secondary_label: '',
                secondary_href: '',
              })
            }
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition bg-white text-stone-700 border-stone-200 hover:bg-stone-50 disabled:opacity-50"
          >
            <Plus size={16} />
            CTA
          </button>
        </div>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
            preview ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
          }`}
        >
          {preview ? <EyeOff size={16} /> : <Eye size={16} />}
          Preview
        </button>
      </div>

      <div className="grid gap-3">
        {blocks.map((b, idx) => (
          <div key={b.id} className="bg-white border border-stone-200 rounded-[1.5rem] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-500">{b.type}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={disabled || idx === 0}
                  onClick={() => onChange(moveItem(blocks, idx, idx - 1))}
                  className="p-2 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-100 disabled:opacity-40"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  disabled={disabled || idx === blocks.length - 1}
                  onClick={() => onChange(moveItem(blocks, idx, idx + 1))}
                  className="p-2 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-100 disabled:opacity-40"
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(blocks.filter((_, i) => i !== idx))}
                  className="p-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="p-4">
              {b.type === 'rich_text' ? (
                <Editor value={String(b.html || '')} onChange={(v: string) => onChange(blocks.map((x, i) => (i === idx ? { ...x, html: v } : x)) as any)} />
              ) : b.type === 'image' ? (
                <div className="grid gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">URL</div>
                    <input
                      disabled={disabled}
                      value={String(b.url || '')}
                      onChange={(e) => onChange(blocks.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)) as any)}
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      placeholder="https://…"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">Alt</div>
                      <input
                        disabled={disabled}
                        value={String(b.alt || '')}
                        onChange={(e) => onChange(blocks.map((x, i) => (i === idx ? { ...x, alt: e.target.value } : x)) as any)}
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">Popisek</div>
                      <input
                        disabled={disabled}
                        value={String(b.caption || '')}
                        onChange={(e) => onChange(blocks.map((x, i) => (i === idx ? { ...x, caption: e.target.value } : x)) as any)}
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      />
                    </div>
                  </div>
                </div>
              ) : b.type === 'divider' ? (
                <div className="text-sm text-stone-500 font-medium">---</div>
              ) : b.type === 'cta' ? (
                <div className="grid gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">Titulek</div>
                    <input
                      disabled={disabled}
                      value={String(b.title || '')}
                      onChange={(e) => onChange(blocks.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)) as any)}
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">Text</div>
                    <textarea
                      disabled={disabled}
                      value={String(b.body || '')}
                      onChange={(e) => onChange(blocks.map((x, i) => (i === idx ? { ...x, body: e.target.value } : x)) as any)}
                      rows={4}
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition resize-none"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">Primární label</div>
                      <input
                        disabled={disabled}
                        value={String(b.primary_label || '')}
                        onChange={(e) => onChange(blocks.map((x, i) => (i === idx ? { ...x, primary_label: e.target.value } : x)) as any)}
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">Primární href</div>
                      <input
                        disabled={disabled}
                        value={String(b.primary_href || '')}
                        onChange={(e) => onChange(blocks.map((x, i) => (i === idx ? { ...x, primary_href: e.target.value } : x)) as any)}
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                        placeholder="/cs/…"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">Sekundární label</div>
                      <input
                        disabled={disabled}
                        value={String(b.secondary_label || '')}
                        onChange={(e) => onChange(blocks.map((x, i) => (i === idx ? { ...x, secondary_label: e.target.value } : x)) as any)}
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">Sekundární href</div>
                      <input
                        disabled={disabled}
                        value={String(b.secondary_href || '')}
                        onChange={(e) => onChange(blocks.map((x, i) => (i === idx ? { ...x, secondary_href: e.target.value } : x)) as any)}
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                        placeholder="/cs/…"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {preview ? (
        <div className="bg-white border border-stone-200 rounded-[2rem] p-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Preview</div>
          <PageBlocksRenderer blocks={blocks} />
          <div className="mt-6 text-[10px] font-black uppercase tracking-widest text-stone-400">content_html (auto)</div>
          <pre className="mt-2 text-xs bg-stone-50 border border-stone-200 rounded-2xl p-4 overflow-auto whitespace-pre-wrap break-words text-stone-700">{htmlPreview}</pre>
        </div>
      ) : null}
    </div>
  );
}

