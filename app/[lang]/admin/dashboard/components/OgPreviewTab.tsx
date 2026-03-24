'use client';

import React, { useMemo, useState } from 'react';
import { Eye, Link as LinkIcon, Search } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import CopyButton from '@/app/components/CopyButton';
import { supabase } from '@/lib/supabase';

export default function OgPreviewTab() {
  const { showToast } = useToast();
  const [url, setUrl] = useState('https://pupen.org/cs');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchPreview = async () => {
    setLoading(true);
    setData(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nepřihlášen');
      const res = await fetch(`/api/admin/og-preview?url=${encodeURIComponent(url)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Fetch failed');
      setData(json);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoading(false);
    }
  };

  const tags = useMemo(() => {
    if (!data?.ok) return '';
    const lines = [
      `<meta property="og:title" content="${data.title || ''}">`,
      `<meta property="og:description" content="${data.description || ''}">`,
      data.image ? `<meta property="og:image" content="${data.image}">` : '',
      `<meta property="og:url" content="${data.url || data.finalUrl || ''}">`,
    ].filter(Boolean);
    return lines.join('\n');
  }, [data]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
              <Eye className="text-green-600" />
              OG Preview
            </h2>
            <p className="text-stone-500 font-medium">Náhled OpenGraph meta pro URL na pupen.org.</p>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-9 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              placeholder="https://pupen.org/cs/novinky/123"
            />
          </div>
          <button
            type="button"
            onClick={fetchPreview}
            disabled={loading || !url.trim()}
            className="md:col-span-3 w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? <InlinePulse className="bg-white/80" size={14} /> : <LinkIcon size={16} />}
            Načíst
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Náhled</div>
            {!data ? (
              <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                Zadejte URL a načtěte preview.
              </div>
            ) : (
              <div className="border border-stone-200 rounded-2xl overflow-hidden">
                {data.image ? (
                  <div className="relative aspect-[1.91/1] bg-stone-100">
                    <img src={data.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-[1.91/1] bg-stone-100" />
                )}
                <div className="p-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-2 truncate">
                    {data.url || data.finalUrl || ''}
                  </div>
                  <div className="text-lg font-black text-stone-900 leading-tight">{data.title || '—'}</div>
                  <div className="mt-2 text-sm font-medium text-stone-600 leading-relaxed line-clamp-3">
                    {data.description || '—'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Meta tagy</div>
              <CopyButton value={tags} idleLabel="Kopírovat" copiedLabel="OK" className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50" />
            </div>
            <pre className="bg-stone-50 border border-stone-100 rounded-2xl p-4 text-xs font-mono overflow-x-auto text-stone-700">
              {tags || '—'}
            </pre>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Omezení</div>
            <div className="text-sm font-medium text-stone-600 leading-relaxed">
              Nástroj načítá pouze URL na pupen.org (a localhost pro vývoj).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
