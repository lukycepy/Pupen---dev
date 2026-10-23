'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Item = {
  id: string;
  label: string;
  full: string;
  provider?: string;
  score?: number | null;
  lat?: number | null;
  lon?: number | null;
  city?: string;
  street?: string;
  house_number?: string;
  postcode?: string;
};

export default function AddressAutocomplete({
  lang,
  value,
  onChange,
  onSelect,
  placeholder,
  inputClassName,
}: {
  lang: string;
  value: string;
  onChange: (v: string) => void;
  onSelect?: (it: Item) => void;
  placeholder?: string;
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const q = useMemo(() => String(value || '').trim(), [value]);

  useEffect(() => {
    let alive = true;
    if (q.length < 3) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/address/suggest?q=${encodeURIComponent(q)}&lang=${lang === 'en' ? 'en' : 'cs'}`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        const next = Array.isArray(json?.items) ? (json.items as Item[]) : [];
        if (alive) setItems(next);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [lang, q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(e.target as any)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (it: Item) => {
    onChange(it.full || it.label);
    onSelect?.(it);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={inputClassName || 'w-full bg-stone-50 border-none rounded-2xl px-5 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition'}
        placeholder={placeholder || (lang === 'en' ? 'Street, city, postcode' : 'Ulice, město, PSČ')}
      />

      {open && (loading || items.length > 0) && (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-stone-200 bg-white shadow-xl overflow-hidden">
          {loading && (
            <div className="px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-widest">
              {lang === 'en' ? 'Searching…' : 'Hledám…'}
            </div>
          )}
          {!loading &&
            items.map((it) => (
              <button
                key={it.id || it.label}
                type="button"
                onClick={() => choose(it)}
                className="w-full text-left px-4 py-3 hover:bg-green-50 transition border-t border-stone-100 first:border-t-0"
              >
                <div className="text-sm font-bold text-stone-800">{it.label}</div>
                {(it.city || it.postcode) && (
                  <div className="text-[11px] font-bold text-stone-400">
                    {[it.postcode, it.city].filter(Boolean).join(' ')}
                  </div>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
