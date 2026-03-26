'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Siren, Phone, Mail, Link as LinkIcon, ShieldAlert, Download, QrCode } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import QrDesigner from '@/app/components/QrDesigner';
import { getDictionary } from '@/lib/get-dictionary';
import Modal from '@/app/components/ui/Modal';

type Contact = {
  id: string;
  title: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  note: string | null;
};

export default function SosPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [dict, setDict] = useState<any>(null);

  const CACHE_KEY = 'pupen_sos_cache_v1';

  useEffect(() => {
    getDictionary(lang).then((d) => setDict(d));
  }, [lang]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/sos');
        const json = await res.json().catch(() => ({}));
        const next = (json?.items || []) as Contact[];
        if (mounted) setItems(next);
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify({ items: next, savedAt: new Date().toISOString() }));
          if (mounted) setCachedAt(new Date().toISOString());
        } catch {}
      } catch {
        try {
          const raw = window.localStorage.getItem(CACHE_KEY);
          const parsed = raw ? JSON.parse(raw) : null;
          const cachedItems = Array.isArray(parsed?.items) ? (parsed.items as Contact[]) : [];
          if (mounted) setItems(cachedItems);
          if (mounted) setCachedAt(typeof parsed?.savedAt === 'string' ? parsed.savedAt : null);
        } catch {
          if (mounted) setItems([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang]);

  const t = dict?.sosPage || {};

  const groups = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const i of items) {
      const key = i.category || t.otherCategory || '';
      map.set(key, [...(map.get(key) || []), i]);
    }
    return Array.from(map.entries());
  }, [items, t.otherCategory]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
        <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight flex items-center gap-3">
          <Siren className="text-red-600" />
          {t.title || ''}
        </h1>
        <p className="text-stone-500 font-medium mt-2">
          {t.subtitle || ''}
        </p>
        <div className="mt-6 flex items-start gap-3 p-5 rounded-[2rem] bg-red-50 border border-red-200">
          <ShieldAlert className="text-red-700 mt-0.5" size={18} />
          <div className="text-sm text-red-800 font-bold">
            {t.emergencyNote || ''}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href="/api/sos/export?format=vcf"
            className="inline-flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-2xl font-bold text-sm hover:bg-stone-800 transition"
          >
            <Download size={18} />
            {t.exportVcard || 'Export vCard'}
          </a>
          <a
            href="/api/sos/export?format=csv"
            className="inline-flex items-center gap-2 bg-white text-stone-700 px-5 py-3 rounded-2xl font-bold text-sm hover:bg-stone-50 transition border border-stone-200"
          >
            <Download size={18} />
            {t.exportCsv || 'Export CSV'}
          </a>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="inline-flex items-center gap-2 bg-white text-stone-700 px-5 py-3 rounded-2xl font-bold text-sm hover:bg-stone-50 transition border border-stone-200"
          >
            <QrCode size={18} />
            {t.qr || 'QR'}
          </button>
          {cachedAt ? (
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              {t.offlineCache || ''}: {new Date(cachedAt).toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ')}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <InlinePulse className="bg-stone-200" size={20} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-[3rem] border border-dashed border-stone-200 p-16 text-center">
          <div className="font-black text-stone-900">{t.emptyTitle || ''}</div>
          <div className="text-stone-400 font-medium mt-2">
            {t.emptySubtitle || ''}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([group, list]) => (
            <div key={group} className="bg-white rounded-[3rem] border border-stone-100 shadow-sm p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{group}</div>
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                {list.map((c) => (
                  <div key={c.id} className="p-6 rounded-[2rem] bg-stone-50 border border-stone-100">
                    <div className="font-black text-stone-900">{c.title}</div>
                    {c.note ? <div className="text-stone-600 font-medium mt-2">{c.note}</div> : null}
                    <div className="mt-4 grid gap-2">
                      {c.phone ? (
                        <a className="inline-flex items-center gap-2 font-bold text-stone-700 hover:text-green-700 transition" href={`tel:${c.phone}`}>
                          <Phone size={16} className="text-green-600" /> {c.phone}
                        </a>
                      ) : null}
                      {c.email ? (
                        <a className="inline-flex items-center gap-2 font-bold text-stone-700 hover:text-green-700 transition" href={`mailto:${c.email}`}>
                          <Mail size={16} className="text-green-600" /> {c.email}
                        </a>
                      ) : null}
                      {c.url ? (
                        <a className="inline-flex items-center gap-2 font-bold text-stone-700 hover:text-green-700 transition" href={c.url} target="_blank" rel="noreferrer">
                          <LinkIcon size={16} className="text-green-600" /> {t.website || ''}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} maxWidthClassName="max-w-xl">
        <QrDesigner
          title={t.qrTitle || ''}
          subtitle={t.qrSubtitle || ''}
          initialText={`${typeof window !== 'undefined' ? window.location.origin : 'https://pupen.org'}/${lang}/sos`}
          initialCaption={t.qrCaption || 'SOS'}
        />
      </Modal>
    </div>
  );
}
