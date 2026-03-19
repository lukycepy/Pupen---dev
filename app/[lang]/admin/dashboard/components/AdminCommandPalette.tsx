'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Command } from 'lucide-react';
import { buildAdminMenuGroups } from './adminMenu';

type Item = {
  id: string;
  label: string;
  groupTitle: string;
  icon: any;
};

export default function AdminCommandPalette({
  open,
  onClose,
  onSelectTab,
  dict,
  permissions,
}: {
  open: boolean;
  onClose: () => void;
  onSelectTab: (tabId: string) => void;
  dict: any;
  permissions: any;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const allItems = useMemo<Item[]>(() => {
    const groups = buildAdminMenuGroups(dict, permissions);
    return groups
      .flatMap((g) =>
        g.items.map((it) => ({
          id: it.id,
          label: it.label,
          groupTitle: g.title,
          icon: it.icon,
          visible: it.visible,
        }))
      )
      .filter((it: any) => it.visible)
      .map(({ visible, ...rest }: any) => rest);
  }, [dict, permissions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (it) => it.label?.toLowerCase().includes(q) || it.groupTitle?.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (!item) return;
        onSelectTab(item.id);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filtered, onClose, onSelectTab, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-start justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Zavřít"
      />

      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] border border-stone-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-stone-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-center text-stone-400">
            <Command size={18} />
          </div>
          <div className="flex-grow relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="Hledat modul…"
              className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
            />
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 hidden sm:block">
            Esc
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
              Nic nenalezeno
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((it, idx) => (
                <button
                  key={`${it.id}-${it.groupTitle}`}
                  type="button"
                  onClick={() => {
                    onSelectTab(it.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition ${
                    idx === activeIndex ? 'bg-green-50 border border-green-200' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-white border border-stone-100 flex items-center justify-center text-green-600 shadow-sm shrink-0">
                    <it.icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-stone-900">{it.label}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 truncate">
                      {it.groupTitle}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-stone-100 text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center justify-between">
          <span>↑↓ výběr, Enter otevřít</span>
          <span>{dict?.admin?.tabAnalytics ? 'Ctrl+K / ⌘K' : 'Ctrl+K'}</span>
        </div>
      </div>
    </div>
  );
}
