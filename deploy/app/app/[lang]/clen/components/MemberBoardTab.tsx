'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { Users } from 'lucide-react';

export default function MemberBoardTab({ lang }: { lang: string }) {
  const { showToast } = useToast();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');
        const res = await fetch('/api/governance/board', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Request failed');
        setRoles(Array.isArray(json.roles) ? json.roles : []);
        setUpdatedAt(json.updatedAt || null);
      } catch (e: any) {
        showToast(e?.message || 'Chyba', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [lang, showToast]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm">
        <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
          <Users className="text-green-600" />
          {lang === 'en' ? 'Board directory' : 'Vedení'}
        </h2>
        <p className="text-stone-500 font-medium mt-3">
          {lang === 'en'
            ? 'Contacts for the association leadership.'
            : 'Kontakty na vedení spolku.'}
        </p>
        {updatedAt && (
          <div className="mt-4 text-[10px] font-black uppercase tracking-widest text-stone-300">
            {lang === 'en' ? 'Updated' : 'Aktualizováno'}: {new Date(updatedAt).toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ')}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-[3rem] border border-stone-100 shadow-sm">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : roles.length === 0 ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            {lang === 'en' ? 'No entries yet.' : 'Zatím bez záznamu.'}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {roles.map((r: any, idx: number) => (
              <div key={idx} className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{r.role}</div>
                <div className="mt-2 text-lg font-black text-stone-900">{r.name || '—'}</div>
                {r.email && (
                  <a href={`mailto:${r.email}`} className="mt-2 inline-block text-sm font-bold text-green-700 hover:text-green-800 transition">
                    {r.email}
                  </a>
                )}
                {r.note && <div className="mt-3 text-sm font-medium text-stone-600">{r.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

