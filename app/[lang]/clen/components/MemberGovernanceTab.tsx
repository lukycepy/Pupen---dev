'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import { richTextToClientHtml } from '@/lib/richtext-client';
import { useToast } from '@/app/context/ToastContext';
import { FileText, Gavel, ScrollText } from 'lucide-react';
import { useSitePageContent } from '@/app/[lang]/components/useSitePageContent';

type Policy = {
  id: string;
  updated_at: string;
  slug: string;
  title: string;
  description: string | null;
  version: { id: string; version_number: number; content_html: string; created_at: string } | null;
};

type Decision = {
  id: string;
  created_at: string;
  meeting_id: string | null;
  meeting_title: string | null;
  title: string;
  summary_html: string;
  status: string;
  decided_at: string | null;
};

export default function MemberGovernanceTab({ lang }: { lang: string }) {
  const { showToast } = useToast();
  const { title: pageTitle, html: pageHtml } = useSitePageContent('governance', lang);
  const [mode, setMode] = useState<'policies' | 'decisions'>('policies');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPolicyId, setOpenPolicyId] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');
    return token;
  }, [lang]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const [polRes, decRes] = await Promise.all([
        fetch('/api/governance/policies', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/governance/decisions', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const polJson = await polRes.json().catch(() => ({}));
      if (!polRes.ok) throw new Error(polJson?.error || 'Request failed');
      const decJson = await decRes.json().catch(() => ({}));
      if (!decRes.ok) throw new Error(decJson?.error || 'Request failed');

      setPolicies(polJson.policies || []);
      setDecisions(decJson.decisions || []);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoading(false);
    }
  }, [getToken, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const decisionsByMeeting = useMemo(() => {
    const groups = new Map<string, { title: string; items: Decision[] }>();
    for (const d of decisions) {
      const key = d.meeting_id ? String(d.meeting_id) : 'no_meeting';
      const label = d.meeting_title ? String(d.meeting_title) : (lang === 'en' ? 'Other' : 'Ostatní');
      if (!groups.has(key)) groups.set(key, { title: label, items: [] });
      groups.get(key)!.items.push(d);
    }
    return Array.from(groups.values());
  }, [decisions, lang]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              <ScrollText className="text-green-600" />
              {lang === 'en' ? 'Governance' : 'Governance'}
            </h2>
            <p className="text-stone-500 font-medium mt-2">
              {lang === 'en'
                ? 'Decisions and internal policies for members.'
                : 'Rozhodnutí a interní policy dostupné členům.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMode('policies')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border transition ${
                mode === 'policies' ? 'border-green-200 bg-green-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <FileText size={16} />
              {lang === 'en' ? 'Policies' : 'Policy'}
            </button>
            <button
              type="button"
              onClick={() => setMode('decisions')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border transition ${
                mode === 'decisions' ? 'border-green-200 bg-green-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Gavel size={16} />
              {lang === 'en' ? 'Decisions' : 'Rozhodnutí'}
            </button>
          </div>
        </div>
      </div>

      {pageHtml ? (
        <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-8">
          {pageTitle ? <div className="text-xl font-black text-stone-900 mb-4">{pageTitle}</div> : null}
          <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: pageHtml }} />
        </div>
      ) : null}

      {loading ? (
        <div className="bg-white p-16 rounded-[3rem] border border-stone-100 shadow-sm flex items-center justify-center">
          <InlinePulse className="bg-stone-200" size={18} />
        </div>
      ) : mode === 'policies' ? (
        <div className="space-y-4">
          {policies.length === 0 ? (
            <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">{lang === 'en' ? 'No policies yet.' : 'Zatím žádné policy.'}</p>
            </div>
          ) : (
            policies.map((p) => (
              <div key={p.id} className="bg-white rounded-[3rem] border border-stone-100 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenPolicyId((v) => (v === p.id ? null : p.id))}
                  className="w-full text-left p-8 hover:bg-stone-50 transition"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <div className="text-xl font-black text-stone-900 truncate">{p.title}</div>
                      {p.description ? <div className="text-stone-500 font-medium mt-2">{p.description}</div> : null}
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 mt-3">
                        {lang === 'en' ? 'Updated' : 'Aktualizováno'}:{' '}
                        {p.updated_at ? new Date(p.updated_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ') : '—'}
                      </div>
                    </div>
                    <div className="shrink-0 text-[10px] font-black uppercase tracking-widest text-green-700 bg-green-50 border border-green-100 px-3 py-1.5 rounded-full">
                      v{p.version?.version_number || 1}
                    </div>
                  </div>
                </button>
                {openPolicyId === p.id && (
                  <div className="p-8 border-t border-stone-100 bg-stone-50/30">
                    {p.version?.content_html ? (
                      <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: richTextToClientHtml(String(p.version.content_html)) }} />
                    ) : (
                      <div className="text-stone-400 italic">{lang === 'en' ? 'Missing content.' : 'Chybí obsah.'}</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {decisions.length === 0 ? (
            <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">{lang === 'en' ? 'No decisions yet.' : 'Zatím žádná rozhodnutí.'}</p>
            </div>
          ) : (
            decisionsByMeeting.map((g) => (
              <div key={g.title} className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">{g.title}</div>
                <div className="space-y-4">
                  {g.items.map((d) => (
                    <div key={d.id} className="p-6 bg-stone-50 rounded-[2.5rem] border border-stone-100">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-lg font-black text-stone-900">{d.title}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                          {d.decided_at ? new Date(d.decided_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ') : ''}
                        </div>
                      </div>
                      <div className="mt-4 prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: richTextToClientHtml(String(d.summary_html || '')) }} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
