'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/app/context/ToastContext';
import InlinePulse from '@/app/components/InlinePulse';
import { FileText, Plus, Save, Trash2, Edit3, CheckCircle, X, ShieldCheck, ShieldX } from 'lucide-react';
import { richTextToClientHtml } from '@/lib/richtext-client';

const Editor = dynamic(() => import('../../../components/Editor'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200" />,
});

type Decision = {
  id: string;
  created_at: string;
  updated_at: string;
  meeting_id: string | null;
  meeting_title: string | null;
  title: string;
  summary_html: string;
  status: string;
  decided_at: string | null;
  is_published: boolean;
};

type Policy = {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  title: string;
  description: string | null;
  is_published: boolean;
  published_version_id: string | null;
};

export default function GovernanceTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'decisions' | 'policies'>('decisions');

  const [decisionFormOpen, setDecisionFormOpen] = useState(false);
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);
  const [decisionForm, setDecisionForm] = useState({
    title: '',
    meetingId: '',
    meetingTitle: '',
    status: 'draft',
    isPublished: false,
    summaryHtml: '',
  });

  const [policyFormOpen, setPolicyFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [policyForm, setPolicyForm] = useState({
    title: '',
    slug: '',
    description: '',
    isPublished: false,
    contentHtml: '',
  });

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Nepřihlášen');
    return token;
  }, []);

  const { data: meetings = [] } = useQuery({
    queryKey: ['admin_governance_meetings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meetings').select('id, title, date').order('date', { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const meetingsById = useMemo(() => {
    const m = new Map<string, any>();
    for (const row of meetings as any[]) m.set(String(row.id), row);
    return m;
  }, [meetings]);

  const { data: decisions = [], isLoading: loadingDecisions } = useQuery({
    queryKey: ['admin_governance_decisions'],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch('/api/admin/governance/decisions', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json.decisions || [];
    },
  });

  const { data: policies = [], isLoading: loadingPolicies } = useQuery({
    queryKey: ['admin_governance_policies'],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch('/api/admin/governance/policies', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      return json.policies || [];
    },
  });

  const resetDecisionForm = useCallback(() => {
    setEditingDecision(null);
    setDecisionFormOpen(false);
    setDecisionForm({ title: '', meetingId: '', meetingTitle: '', status: 'draft', isPublished: false, summaryHtml: '' });
  }, []);

  const resetPolicyForm = useCallback(() => {
    setEditingPolicy(null);
    setPolicyFormOpen(false);
    setPolicyForm({ title: '', slug: '', description: '', isPublished: false, contentHtml: '' });
  }, []);

  const saveDecision = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const payload = {
        title: decisionForm.title,
        meetingId: decisionForm.meetingId || null,
        meetingTitle: decisionForm.meetingId ? (meetingsById.get(decisionForm.meetingId)?.title || decisionForm.meetingTitle || null) : null,
        status: decisionForm.status,
        isPublished: decisionForm.isPublished,
        summaryHtml: decisionForm.summaryHtml,
      };

      if (!editingDecision) {
        const res = await fetch('/api/admin/governance/decisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Uložení selhalo');
        return json.decision;
      }

      const res = await fetch(`/api/admin/governance/decisions/${encodeURIComponent(editingDecision.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Uložení selhalo');
      return json.decision;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_governance_decisions'] });
      showToast(editingDecision ? 'Rozhodnutí upraveno' : 'Rozhodnutí uloženo', 'success');
      resetDecisionForm();
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const deleteDecision = useMutation({
    mutationFn: async (decisionId: string) => {
      const token = await getToken();
      const res = await fetch(`/api/admin/governance/decisions/${encodeURIComponent(decisionId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Smazání selhalo');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_governance_decisions'] });
      showToast('Rozhodnutí smazáno', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const savePolicy = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const payload = {
        title: policyForm.title,
        slug: policyForm.slug || null,
        description: policyForm.description || null,
        isPublished: policyForm.isPublished,
        contentHtml: policyForm.contentHtml,
      };

      if (!editingPolicy) {
        const res = await fetch('/api/admin/governance/policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Uložení selhalo');
        return json.policy;
      }

      const metaRes = await fetch(`/api/admin/governance/policies/${encodeURIComponent(editingPolicy.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: payload.title, slug: payload.slug, description: payload.description }),
      });
      const metaJson = await metaRes.json().catch(() => ({}));
      if (!metaRes.ok) throw new Error(metaJson?.error || 'Uložení selhalo');

      const verRes = await fetch(`/api/admin/governance/policies/${encodeURIComponent(editingPolicy.id)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentHtml: payload.contentHtml, publish: payload.isPublished }),
      });
      const verJson = await verRes.json().catch(() => ({}));
      if (!verRes.ok) throw new Error(verJson?.error || 'Uložení selhalo');

      if (!payload.isPublished) {
        await fetch(`/api/admin/governance/policies/${encodeURIComponent(editingPolicy.id)}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ publish: false }),
        });
      }

      return metaJson.policy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_governance_policies'] });
      showToast(editingPolicy ? 'Policy uložena (nová verze)' : 'Policy vytvořena', 'success');
      resetPolicyForm();
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const deletePolicy = useMutation({
    mutationFn: async (policyId: string) => {
      const token = await getToken();
      const res = await fetch(`/api/admin/governance/policies/${encodeURIComponent(policyId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Smazání selhalo');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_governance_policies'] });
      showToast('Policy smazána', 'success');
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  useEffect(() => {
    if (decisionFormOpen) return;
    setEditingDecision(null);
  }, [decisionFormOpen]);

  useEffect(() => {
    if (policyFormOpen) return;
    setEditingPolicy(null);
  }, [policyFormOpen]);

  const title = dict?.admin?.tabGovernance || 'Governance';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <FileText className="text-green-600" />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('decisions')}
            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
              mode === 'decisions' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            Rozhodnutí
          </button>
          <button
            type="button"
            onClick={() => setMode('policies')}
            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition ${
              mode === 'policies' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            Policy
          </button>
        </div>
      </div>

      {mode === 'decisions' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center justify-between">
            <div className="text-sm font-bold text-stone-700">Decision register</div>
            <button
              type="button"
              onClick={() => {
                setDecisionFormOpen(true);
                setEditingDecision(null);
                setDecisionForm({ title: '', meetingId: '', meetingTitle: '', status: 'draft', isPublished: false, summaryHtml: '' });
              }}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition"
            >
              <Plus size={16} />
              Nové rozhodnutí
            </button>
          </div>

          {decisionFormOpen && (
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název rozhodnutí</label>
                  <input
                    type="text"
                    value={decisionForm.title}
                    onChange={(e) => setDecisionForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    placeholder="Např. Schválení rozpočtu na akci"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Schůze (volitelné)</label>
                  <select
                    value={decisionForm.meetingId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const meeting = id ? meetingsById.get(id) : null;
                      setDecisionForm((p) => ({ ...p, meetingId: id, meetingTitle: meeting?.title || '' }));
                    }}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  >
                    <option value="">Bez schůze</option>
                    {(meetings as any[]).map((m) => (
                      <option key={String(m.id)} value={String(m.id)}>
                        {m.title} ({m.date ? new Date(m.date).toLocaleDateString('cs-CZ') : '—'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Stav</label>
                  <select
                    value={decisionForm.status}
                    onChange={(e) => setDecisionForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  >
                    <option value="draft">draft</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setDecisionForm((p) => ({ ...p, isPublished: !p.isPublished }))}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border transition ${
                      decisionForm.isPublished ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {decisionForm.isPublished ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
                    {decisionForm.isPublished ? 'Publikováno pro členy' : 'Nepublikováno'}
                  </button>
                  <button
                    type="button"
                    onClick={resetDecisionForm}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                  >
                    <X size={14} />
                    Zrušit
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 block mb-2">Obsah</label>
                <Editor value={decisionForm.summaryHtml} onChange={(val: string) => setDecisionForm((p) => ({ ...p, summaryHtml: val }))} />
              </div>

              <button
                type="button"
                onClick={() => saveDecision.mutate()}
                disabled={!decisionForm.title.trim() || !decisionForm.summaryHtml.trim() || saveDecision.isPending}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
              >
                {saveDecision.isPending ? <InlinePulse className="bg-white/80" size={16} /> : <Save size={18} />}
                {editingDecision ? 'Uložit změny' : 'Uložit rozhodnutí'}
              </button>
            </div>
          )}

          <div className="grid gap-4">
            {loadingDecisions ? (
              <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm flex items-center justify-center">
                <InlinePulse className="bg-stone-200" size={18} />
              </div>
            ) : (decisions as Decision[]).length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
                <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Zatím žádná rozhodnutí</p>
              </div>
            ) : (
              (decisions as Decision[]).map((d) => (
                <div key={d.id} className="bg-white p-6 rounded-[2rem] border shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                        <span className={`px-3 py-1 rounded-full ${d.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
                          {d.status}
                        </span>
                        <span className={`px-3 py-1 rounded-full ${d.is_published ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-stone-50 text-stone-500 border border-stone-200'}`}>
                          {d.is_published ? 'členové' : 'interně'}
                        </span>
                        {d.meeting_title ? <span className="truncate">Schůze: {d.meeting_title}</span> : null}
                      </div>
                      <div className="text-lg font-black text-stone-900 truncate">{d.title}</div>
                      <div className="mt-3 prose prose-stone max-w-none text-stone-700" dangerouslySetInnerHTML={{ __html: richTextToClientHtml(String(d.summary_html || '')) }} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionFormOpen(true);
                          setEditingDecision(d);
                          setDecisionForm({
                            title: d.title,
                            meetingId: d.meeting_id || '',
                            meetingTitle: d.meeting_title || '',
                            status: d.status || 'draft',
                            isPublished: !!d.is_published,
                            summaryHtml: d.summary_html || '',
                          });
                        }}
                        className="p-4 bg-stone-50 text-stone-600 rounded-2xl hover:bg-stone-900 hover:text-white transition shadow-sm"
                      >
                        <Edit3 size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDecision.mutate(d.id)}
                        disabled={deleteDecision.isPending}
                        className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition shadow-sm disabled:opacity-50"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {mode === 'policies' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center justify-between">
            <div className="text-sm font-bold text-stone-700">Policy knihovna</div>
            <button
              type="button"
              onClick={() => {
                setPolicyFormOpen(true);
                setEditingPolicy(null);
                setPolicyForm({ title: '', slug: '', description: '', isPublished: false, contentHtml: '' });
              }}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition"
            >
              <Plus size={16} />
              Nová policy
            </button>
          </div>

          {policyFormOpen && (
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název</label>
                  <input
                    type="text"
                    value={policyForm.title}
                    onChange={(e) => setPolicyForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    placeholder="Např. Refund policy"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Slug</label>
                  <input
                    type="text"
                    value={policyForm.slug}
                    onChange={(e) => setPolicyForm((p) => ({ ...p, slug: e.target.value }))}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                    placeholder="refund-policy"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setPolicyForm((p) => ({ ...p, isPublished: !p.isPublished }))}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border transition ${
                      policyForm.isPublished ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {policyForm.isPublished ? <CheckCircle size={14} /> : <X size={14} />}
                    {policyForm.isPublished ? 'Publikováno' : 'Draft'}
                  </button>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Popis (volitelné)</label>
                  <textarea
                    value={policyForm.description}
                    onChange={(e) => setPolicyForm((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
                    placeholder="Krátké vysvětlení, pro koho to je a co řeší…"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 block mb-2">Obsah</label>
                <Editor value={policyForm.contentHtml} onChange={(val: string) => setPolicyForm((p) => ({ ...p, contentHtml: val }))} />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => savePolicy.mutate()}
                  disabled={!policyForm.title.trim() || !policyForm.contentHtml.trim() || savePolicy.isPending}
                  className="flex-1 bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
                >
                  {savePolicy.isPending ? <InlinePulse className="bg-white/80" size={16} /> : <Save size={18} />}
                  {editingPolicy ? 'Uložit novou verzi' : 'Vytvořit policy'}
                </button>
                <button
                  type="button"
                  onClick={resetPolicyForm}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                >
                  <X size={14} />
                  Zrušit
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-4">
            {loadingPolicies ? (
              <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm flex items-center justify-center">
                <InlinePulse className="bg-stone-200" size={18} />
              </div>
            ) : (policies as Policy[]).length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
                <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Zatím žádné policy</p>
              </div>
            ) : (
              (policies as Policy[]).map((p) => (
                <div key={p.id} className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                      <span className={`px-3 py-1 rounded-full ${p.is_published ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
                        {p.is_published ? 'publikováno' : 'draft'}
                      </span>
                      <span className="truncate">{p.slug}</span>
                    </div>
                    <div className="text-lg font-black text-stone-900 truncate">{p.title}</div>
                    {p.description ? <div className="mt-2 text-sm font-medium text-stone-600">{p.description}</div> : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        setPolicyFormOpen(true);
                        setEditingPolicy(p);
                        setPolicyForm({
                          title: p.title,
                          slug: p.slug,
                          description: p.description || '',
                          isPublished: !!p.is_published,
                          contentHtml: '',
                        });
                        try {
                          const token = await getToken();
                          const res = await fetch(`/api/admin/governance/policies/${encodeURIComponent(p.id)}/versions`, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          const json = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(json?.error || 'Načtení verze selhalo');
                          const latest = Array.isArray(json.versions) ? json.versions[0] : null;
                          if (latest?.content_html) {
                            setPolicyForm((prev) => ({ ...prev, contentHtml: String(latest.content_html) }));
                          }
                        } catch (e: any) {
                          showToast(e?.message || 'Chyba', 'error');
                        }
                      }}
                      className="p-4 bg-stone-50 text-stone-600 rounded-2xl hover:bg-stone-900 hover:text-white transition shadow-sm"
                    >
                      <Edit3 size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePolicy.mutate(p.id)}
                      disabled={deletePolicy.isPending}
                      className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition shadow-sm disabled:opacity-50"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
