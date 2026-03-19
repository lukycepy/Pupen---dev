'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Siren, Phone, Mail, Link as LinkIcon, ShieldAlert } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/sos');
        const json = await res.json().catch(() => ({}));
        if (mounted) setItems((json?.items || []) as Contact[]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const i of items) {
      const key = i.category || (lang === 'en' ? 'Other' : 'Ostatní');
      map.set(key, [...(map.get(key) || []), i]);
    }
    return Array.from(map.entries());
  }, [items, lang]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
        <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight flex items-center gap-3">
          <Siren className="text-red-600" />
          {lang === 'en' ? 'SOS for freshmen' : 'SOS pro prváky'}
        </h1>
        <p className="text-stone-500 font-medium mt-2">
          {lang === 'en'
            ? 'Quick contacts: faculty office, dorm reception, campus doctor.'
            : 'Rychlé kontakty: studijní oddělení, vrátnice kolejí, lékař v kampusu.'}
        </p>
        <div className="mt-6 flex items-start gap-3 p-5 rounded-[2rem] bg-red-50 border border-red-200">
          <ShieldAlert className="text-red-700 mt-0.5" size={18} />
          <div className="text-sm text-red-800 font-bold">
            {lang === 'en'
              ? 'In an emergency, call local emergency services first.'
              : 'V akutním ohrožení volejte nejdřív tísňovou linku.'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <InlinePulse className="bg-stone-200" size={20} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-[3rem] border border-dashed border-stone-200 p-16 text-center">
          <div className="font-black text-stone-900">{lang === 'en' ? 'No contacts yet' : 'Zatím bez kontaktů'}</div>
          <div className="text-stone-400 font-medium mt-2">
            {lang === 'en' ? 'Admins can add contacts in Pupen Control.' : 'Admini mohou přidat kontakty v Pupen Control.'}
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
                          <LinkIcon size={16} className="text-green-600" /> {lang === 'en' ? 'Website' : 'Web'}
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
    </div>
  );
}

