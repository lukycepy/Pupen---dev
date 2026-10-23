'use client';

import React, { useMemo, useState } from 'react';
import { FileText, Calendar, Filter, Search, ExternalLink } from 'lucide-react';

type ItemType = 'events' | 'posts';

type Item = {
  type: ItemType;
  id: string;
  title: string;
  publishedAt: string | null;
  createdAt: string | null;
  meta: string;
};

export default function ContentLibraryTab({
  events,
  posts,
  onGoToTab,
}: {
  events: any[];
  posts: any[];
  onGoToTab: (tab: string) => void;
}) {
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  const all = useMemo<Item[]>(() => {
    const evs = (events || []).map((e: any) => ({
      type: 'events' as const,
      id: String(e.id),
      title: e.title || '---',
      publishedAt: e.published_at || null,
      createdAt: e.created_at || null,
      meta: `${e.category || ''}${e.date ? ` • ${new Date(e.date).toLocaleDateString('cs-CZ')}` : ''}`,
    }));
    const ps = (posts || []).map((p: any) => ({
      type: 'posts' as const,
      id: String(p.id),
      title: p.title || '---',
      publishedAt: p.published_at || null,
      createdAt: p.created_at || null,
      meta: p.category || '',
    }));
    return [...ps, ...evs].sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });
  }, [events, posts]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((it) => {
      if (typeFilter !== 'all' && it.type !== typeFilter) return false;
      const isPublished = !!it.publishedAt;
      if (statusFilter === 'published' && !isPublished) return false;
      if (statusFilter === 'draft' && isPublished) return false;
      if (!query) return true;
      return it.title.toLowerCase().includes(query) || it.meta.toLowerCase().includes(query);
    });
  }, [all, q, statusFilter, typeFilter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
              <FileText className="text-green-600" />
              Knihovna obsahu
            </h2>
            <p className="text-stone-500 font-medium">
              Rychlé vyhledání a filtrování napříč novinkami a akcemi.
            </p>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">
            {filtered.length} položek
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat…"
              className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
            />
          </div>

          <div className="md:col-span-2 grid sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 bg-stone-50 rounded-2xl px-4 py-3 border border-stone-100">
              <Filter size={16} className="text-stone-300" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-transparent font-bold text-sm text-stone-700 outline-none w-full"
              >
                <option value="all">Vše</option>
                <option value="posts">Novinky</option>
                <option value="events">Akce</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-stone-50 rounded-2xl px-4 py-3 border border-stone-100">
              <Calendar size={16} className="text-stone-300" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent font-bold text-sm text-stone-700 outline-none w-full"
              >
                <option value="all">Všechny stavy</option>
                <option value="published">Publikováno</option>
                <option value="draft">Koncept</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                <th className="py-4 px-4">Typ</th>
                <th className="py-4 px-4">Název</th>
                <th className="py-4 px-4">Meta</th>
                <th className="py-4 px-4">Stav</th>
                <th className="py-4 px-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                    Nic nenalezeno.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 100).map((it) => (
                  <tr key={`${it.type}-${it.id}`} className="border-t border-stone-100 hover:bg-stone-50 transition">
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-stone-600">
                        {it.type === 'posts' ? 'Novinka' : 'Akce'}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-bold text-stone-900">{it.title}</td>
                    <td className="py-4 px-4 text-sm text-stone-500 font-medium">{it.meta}</td>
                    <td className="py-4 px-4">
                      {it.publishedAt ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-green-700">
                          Publikováno
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-700">
                          Koncept
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onGoToTab(it.type === 'posts' ? 'blog' : 'events')}
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                      >
                        <ExternalLink size={14} />
                        Otevřít
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
