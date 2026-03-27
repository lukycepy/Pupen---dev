'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Users, Send, Trash2, Download, Search, FileText, Save, History, Plus, Edit2, Loader2, Copy, Paperclip, X } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '@/app/[lang]/components/Skeleton';
import TiptapEditor from '@/app/[lang]/components/Editor';

export default function NewsletterTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [sentCampaigns, setSentCampaigns] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [abEnabled, setAbEnabled] = useState(false);
  const [abSubjectB, setAbSubjectB] = useState('');
  const [abSplit, setAbSplit] = useState(50);
  const [composeHtml, setComposeHtml] = useState('');
  const [composeCats, setComposeCats] = useState<string[]>(['all']);
  const [composeRoleIds, setComposeRoleIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<{name: string, url: string}[]>([]);
  
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'compose' | 'subscribers' | 'history' | 'digest'>('compose');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [digestData, setDigestData] = useState<any>(null);
  const [loadingDigest, setLoadingDigest] = useState(false);

  const fetchDigest = async () => {
    setLoadingDigest(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/digest', { headers: { Authorization: `Bearer ${data.session?.access_token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba načítání digestu');
      setDigestData(json.digest);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoadingDigest(false);
    }
  };

  const importDigestToEditor = () => {
    if (!digestData) return;
    setComposeSubject(digestData.subject || 'Týdenní souhrn');
    setComposeHtml(digestData.html || '');
    setView('compose');
    showToast('Digest načten do editoru', 'success');
  };

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Unauthorized');
        
        const [subsRes, draftsRes, tplRes, rolesRes, historyRes] = await Promise.all([
          fetch('/api/admin/newsletter/subscribers', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/newsletter/drafts', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/newsletter/templates', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/newsletter/roles', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/newsletter/history', { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const [subsJson, draftsJson, tplJson] = await Promise.all([
          subsRes.json().catch(() => ({})),
          draftsRes.json().catch(() => ({})),
          tplRes.json().catch(() => ({})),
        ]);
        const rolesJson: any = rolesRes.ok ? await rolesRes.json().catch(() => ({})) : {};
        const historyJson: any = historyRes.ok ? await historyRes.json().catch(() => ({})) : {};

        if (!isMounted) return;
        setSubscribers(Array.isArray(subsJson?.subscribers) ? subsJson.subscribers : []);
        setDrafts(Array.isArray(draftsJson?.drafts) ? draftsJson.drafts : []);
        setTemplates(Array.isArray(tplJson?.templates) ? tplJson.templates : []);
        setRoles(Array.isArray(rolesJson?.roles) ? rolesJson.roles : []);
        setSentCampaigns(Array.isArray(historyJson?.campaigns) ? historyJson.campaigns : []);
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => { isMounted = false; };
  }, [showToast]);

  const handleDelete = async (id: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch(`/api/admin/newsletter/subscribers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      showToast('Odběratel smazán', 'success');
      setSubscribers(subscribers.filter(s => s.id !== id));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const toggleComposeCat = (id: string) => {
    if (id === 'all') {
      setComposeCats(['all']);
    } else {
      const filtered = composeCats.filter((c) => c !== 'all');
      if (filtered.includes(id)) {
        const next = filtered.filter((c) => c !== id);
        setComposeCats(next.length === 0 ? ['all'] : next);
      } else {
        setComposeCats([...filtered, id]);
      }
    }
  };

  const toggleComposeRole = (id: string) => {
    if (!id) return;
    if (composeRoleIds.includes(id)) {
      setComposeRoleIds(composeRoleIds.filter((x) => x !== id));
    } else {
      setComposeRoleIds([...composeRoleIds, id]);
    }
  };

  const addAttachment = () => {
    const url = prompt('Vložte URL přílohy (musí být veřejně dostupná):');
    if (!url) return;
    const name = prompt('Název přílohy (např. dokument.pdf):') || url.split('/').pop() || 'priloha';
    setAttachments([...attachments, { name, url }]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const sendNewsletter = async () => {
    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: composeSubject,
          html: composeHtml,
          categories: composeCats,
          roleIds: composeRoleIds,
          draftId: activeDraftId,
          attachments,
          ab: { enabled: abEnabled, subjectA: composeSubject, subjectB: abSubjectB, split: abSplit },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      showToast(
        `Newsletter: odesláno ${json?.sent || 0}, ve frontě ${json?.queued || 0}, selhalo ${json?.failed || 0} (celkem ${json?.recipients || 0})`,
        'success'
      );
      
      const [draftsRes, historyRes] = await Promise.all([
        fetch('/api/admin/newsletter/drafts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/newsletter/history', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [draftsJson, historyJson] = await Promise.all([draftsRes.json().catch(() => ({})), historyRes.json().catch(() => ({}))]);
      setDrafts(Array.isArray(draftsJson?.drafts) ? draftsJson.drafts : []);
      setSentCampaigns(Array.isArray(historyJson?.campaigns) ? historyJson.campaigns : []);
      
      setComposeSubject('');
      setAbEnabled(false);
      setAbSubjectB('');
      setAbSplit(50);
      setComposeHtml('');
      setComposeCats(['all']);
      setComposeRoleIds([]);
      setAttachments([]);
      setActiveDraftId(null);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setSending(false);
    }
  };

  const previewNewsletter = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      
      const res = await fetch('/api/admin/newsletter/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: composeSubject, html: composeHtml }),
      });
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba odeslání náhledu');
      
      showToast('Náhled odeslán na váš e-mail', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const confirmDelete = (id: string, email: string) => {
    setModalConfig({
      title: 'Smazat odběratele?',
      message: `Opravdu chcete smazat e-mail ${email} z databáze newsletteru?`,
      onConfirm: () => handleDelete(id)
    });
    setModalOpen(true);
  };

  const handleExport = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/newsletter/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Chyba exportu');
      }
      const csv = await res.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'newsletter_subscribers.csv');
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      
      const url = activeDraftId ? `/api/admin/newsletter/drafts/${activeDraftId}` : '/api/admin/newsletter/drafts';
      const method = activeDraftId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          subject: composeSubject, 
          subject_b: abSubjectB,
          ab_enabled: abEnabled,
          ab_split: abSplit,
          body_html: composeHtml, 
          target_categories: composeCats 
        }),
      });
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      
      if (!activeDraftId) {
        setActiveDraftId(json.draft.id);
      }
      
      // Refresh list
      const dRes = await fetch('/api/admin/newsletter/drafts', { headers: { Authorization: `Bearer ${token}` } });
      const dJson = await dRes.json();
      setDrafts(dJson.drafts || []);
      
      showToast('Draft uložen', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadDraft = (draft: any) => {
    setComposeSubject(draft.subject);
    setAbEnabled(!!draft.ab_enabled);
    setAbSubjectB(String(draft.subject_b || ''));
    setAbSplit(Number.isFinite(Number(draft.ab_split)) ? Number(draft.ab_split) : 50);
    setComposeHtml(draft.body_html);
    setComposeCats(draft.target_categories || ['all']);
    setActiveDraftId(draft.id);
    setView('compose');
  };

  const loadTemplate = (tpl: any) => {
    setComposeSubject(tpl.subject);
    setComposeHtml(tpl.body_html);
    setView('compose');
    showToast('Šablona načtena', 'success');
  };

  const handleCreateTemplate = async () => {
    const name = prompt('Název nové šablony:');
    if (!name) return;
    
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      
      const res = await fetch('/api/admin/newsletter/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name,
          subject: composeSubject || 'Předmět šablony', 
          body_html: composeHtml || '<h3>Začněte psát...</h3>' 
        }),
      });
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Chyba');
      
      setTemplates([...templates, json.template]);
      showToast('Šablona vytvořena', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Smazat šablonu?')) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Unauthorized');
      
      const res = await fetch(`/api/admin/newsletter/templates/${id}`, { 
        method: 'DELETE', 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      if (!res.ok) throw new Error('Chyba při mazání');
      setTemplates(templates.filter(t => t.id !== id));
      showToast('Šablona smazána', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const filteredSubscribers = subscribers.filter(s => {
    const matchesSearch = s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || (s.categories && s.categories.includes(categoryFilter));
    return matchesSearch && matchesCategory;
  });

  if (loading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Mail className="text-green-600" />
          Správa Newsletteru
        </h2>
        <div className="flex bg-stone-100 p-1 rounded-xl">
          <button 
            onClick={() => setView('compose')} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${view === 'compose' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Nová kampaň
          </button>
          <button 
            onClick={() => setView('subscribers')} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${view === 'subscribers' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Odběratelé
          </button>
          <button 
            onClick={() => setView('history')} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${view === 'history' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Drafty & Šablony
          </button>
          <button 
            onClick={() => { setView('digest'); if (!digestData) fetchDigest(); }} 
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${view === 'digest' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <Loader2 size={14} className={loadingDigest ? 'animate-spin' : 'hidden'} />
            Automatický Digest
          </button>
        </div>
      </div>

      {view === 'compose' && (
        <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-bold flex items-center gap-3">
              <Send className="text-green-600" />
              Nová zpráva {activeDraftId && <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-1 rounded-full uppercase tracking-widest font-black">Draft uložen</span>}
            </h3>
            <div className="flex items-center gap-2">
              <button
                disabled={!composeSubject.trim() || !composeHtml.trim() || (abEnabled && !abSubjectB.trim())}
                onClick={previewNewsletter}
                className="flex items-center gap-2 bg-stone-100 text-stone-600 px-5 py-2.5 rounded-xl font-bold hover:bg-stone-200 transition text-sm disabled:opacity-50"
              >
                Odeslat náhled sobě
              </button>
              <button
                disabled={saving || !composeSubject.trim() || !composeHtml.trim() || (abEnabled && !abSubjectB.trim())}
                onClick={saveDraft}
                className="flex items-center gap-2 bg-stone-100 text-stone-600 px-5 py-2.5 rounded-xl font-bold hover:bg-stone-200 transition text-sm disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Uložit draft
              </button>
              <button
                disabled={sending || !composeSubject.trim() || !composeHtml.trim() || (abEnabled && !abSubjectB.trim())}
                onClick={sendNewsletter}
                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-green-700 transition shadow-lg text-sm disabled:opacity-50"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Odeslat všem
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Předmět</div>
              <input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 rounded-xl border border-stone-100 focus:ring-2 focus:ring-green-500 transition font-medium"
                placeholder="Např. Novinky týdne"
              />
            </div>
            <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={abEnabled}
                  onChange={(e) => setAbEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-xs font-bold text-stone-700">A/B test předmětu</span>
              </label>
              {abEnabled && (
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Varianta B</div>
                    <input
                      value={abSubjectB}
                      onChange={(e) => setAbSubjectB(e.target.value)}
                      className="w-full px-4 py-3 bg-white rounded-xl border border-stone-200 focus:ring-2 focus:ring-green-500 transition font-medium"
                      placeholder="Např. Co je nového v Pupenu?"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Split A (%)</div>
                    <input
                      type="number"
                      min={10}
                      max={90}
                      value={abSplit}
                      onChange={(e) => setAbSplit(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-white rounded-xl border border-stone-200 focus:ring-2 focus:ring-green-500 transition font-medium"
                    />
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                      A: {abSplit}% • B: {100 - (Number.isFinite(abSplit) ? abSplit : 50)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Kategorie</div>
              <div className="flex flex-wrap gap-2">
                {['all', 'Párty', 'Vzdělávání', 'Výlet'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleComposeCat(cat)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${composeCats.includes(cat) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                  >
                    {cat === 'all' ? 'Všechny' : cat}
                  </button>
                ))}
              </div>
            </div>
            {roles.length > 0 && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Segment</div>
                <div className="flex flex-wrap gap-2">
                  {roles.map((r: any) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleComposeRole(String(r.id))}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${composeRoleIds.includes(String(r.id)) ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs text-stone-500 font-medium">
              HTML se odešle tak, jak ho vložíš.
            </div>
            
            <div className="pt-4 border-t border-stone-100">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 flex items-center gap-2">
                Přílohy <span className="bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-md">{attachments.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center justify-between bg-stone-50 px-3 py-2 rounded-xl text-xs font-bold text-stone-700">
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip size={14} className="text-stone-400 flex-shrink-0" />
                      <span className="truncate">{a.name}</span>
                    </div>
                    <button onClick={() => removeAttachment(i)} className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-red-500 transition">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAttachment}
                  className="flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-stone-200 rounded-xl text-xs font-bold text-stone-500 hover:border-green-500 hover:text-green-600 transition"
                >
                  <Plus size={14} /> Přidat přílohu (URL)
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Obsah (HTML)</div>
            <TiptapEditor 
              value={composeHtml}
              onChange={(html) => setComposeHtml(html)}
              placeholder="<h3>Ahoj!</h3><p>…</p>"
            />
          </div>
          </div>
        </div>
      )}

      {view === 'subscribers' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-end">
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg text-sm"
            >
              <Download size={18} />
              Exportovat CSV
            </button>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {/* STATS */}
            <div className="md:col-span-1 space-y-4">
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Celkem odběratelů</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-stone-900">{subscribers.length}</span>
                  <Users size={20} className="text-green-600 mb-1" />
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Filtr kategorií</p>
                <div className="space-y-2">
                  {['all', 'Párty', 'Vzdělávání', 'Výlet'].map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${categoryFilter === cat ? 'bg-green-600 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
                    >
                      {cat === 'all' ? 'Všechny' : cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* LIST */}
            <div className="md:col-span-3 space-y-4">
              <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Hledat e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-6 py-3 bg-stone-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 transition font-medium"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-stone-50 border-b">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                      <th className="px-6 py-4">E-mail</th>
                      <th className="px-6 py-4">Kategorie</th>
                      <th className="px-6 py-4">Preference</th>
                      <th className="px-6 py-4">Datum</th>
                      <th className="px-6 py-4 text-right">Akce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {filteredSubscribers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-stone-400 font-bold">
                          Žádní odběratelé k zobrazení
                        </td>
                      </tr>
                    ) : (
                      filteredSubscribers.map((s) => (
                        <tr key={s.id} className="hover:bg-stone-50/50 transition group">
                          <td className="px-6 py-4 font-bold text-stone-900">{s.email}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {s.categories?.map((cat: string) => (
                                <span key={cat} className="text-[9px] font-black uppercase tracking-widest bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {s.preferences?.marketing && <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Marketing</span>}
                              {s.preferences?.transactional && <span className="text-[9px] font-black uppercase tracking-widest bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Transakční</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-stone-500 font-medium">
                            {new Date(s.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => confirmDelete(s.id, s.email)}
                              className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 size={18} />
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
        </div>
      )}

      {view === 'history' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="space-y-6">
            <h3 className="text-xl font-black flex items-center gap-3">
              <History className="text-green-600" />
              Odeslané kampaně
            </h3>
            {sentCampaigns.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400 font-bold">
                Zatím nebyla odeslána žádná kampaň
              </div>
            ) : (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-stone-50 border-b">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                      <th className="px-6 py-4">Předmět</th>
                      <th className="px-6 py-4 text-center">Dosah</th>
                      <th className="px-6 py-4 text-center">Open Rate</th>
                      <th className="px-6 py-4 text-center">Click Rate</th>
                      <th className="px-6 py-4">Odesláno</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {sentCampaigns.map((c: any) => {
                      const openRate = c.target_count ? Math.round((c.open_count / c.target_count) * 100) : 0;
                      const clickRate = c.target_count ? Math.round((c.click_count / c.target_count) * 100) : 0;
                      return (
                        <tr key={c.id} className="hover:bg-stone-50/50 transition">
                          <td className="px-6 py-4 font-bold text-stone-900">{c.subject || '(bez předmětu)'}</td>
                          <td className="px-6 py-4 text-center text-stone-600 font-bold">{c.target_count || 0}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${openRate > 20 ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
                              {openRate}% <span className="text-[10px] text-stone-400 font-normal">({c.open_count || 0})</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${clickRate > 5 ? 'bg-blue-50 text-blue-700' : 'bg-stone-100 text-stone-600'}`}>
                              {clickRate}% <span className="text-[10px] text-stone-400 font-normal">({c.click_count || 0})</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-stone-500 font-medium">
                            {c.sent_at ? new Date(c.sent_at).toLocaleString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h3 className="text-xl font-black flex items-center gap-3">
                <History className="text-amber-500" />
                Uložené drafty
              </h3>
              <div className="space-y-4">
                {drafts.length === 0 ? (
                  <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400 font-bold">
                    Žádné drafty
                  </div>
                ) : (
                  drafts.map(d => (
                    <div key={d.id} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition group">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-stone-900">{d.subject}</h4>
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">Aktualizováno {new Date(d.updated_at).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => loadDraft(d)} className="p-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition" title="Načíst k úpravě">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={async () => {
                            if (!confirm('Smazat draft?')) return;
                            const { data } = await supabase.auth.getSession();
                            await fetch(`/api/admin/newsletter/drafts/${d.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${data.session?.access_token}` } });
                            setDrafts(drafts.filter(x => x.id !== d.id));
                            showToast('Draft smazán', 'success');
                          }} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {d.target_categories?.map((c: string) => (
                          <span key={c} className="text-[9px] font-black uppercase tracking-widest bg-stone-50 text-stone-500 px-2 py-0.5 rounded-full border border-stone-100">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-black flex items-center gap-3">
                <FileText className="text-blue-500" />
                Šablony kampaní
              </h3>
              <div className="space-y-4">
                {templates.length === 0 ? (
                  <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400 font-bold">
                    Žádné šablony
                  </div>
                ) : (
                  templates.map(t => (
                    <div key={t.id} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition group">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-stone-900">{t.name}</h4>
                          <p className="text-xs text-stone-500 mt-1">{t.subject}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => loadTemplate(t)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition" title="Použít šablonu">
                            <Copy size={16} />
                          </button>
                          <button onClick={() => deleteTemplate(t.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition" title="Smazat šablonu">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <button onClick={handleCreateTemplate} className="w-full p-4 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 font-bold hover:bg-stone-50 hover:border-stone-300 transition flex items-center justify-center gap-2">
                  <Plus size={20} /> Uložit aktuální jako šablonu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'digest' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white p-8 rounded-[2rem] border shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-xl font-black flex items-center gap-3">
                  <FileText className="text-purple-600" />
                  Automatický týdenní souhrn (Digest)
                </h3>
                <p className="text-stone-500 mt-2 font-medium max-w-2xl">
                  Digest se generuje automaticky z novinek, akcí a ztrát/nálezů za poslední týden. 
                  Zde si ho můžete prohlédnout a v případě potřeby naimportovat do editoru newsletteru k úpravě a rozeslání všem odběratelům.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={fetchDigest}
                  disabled={loadingDigest}
                  className="flex items-center gap-2 bg-stone-100 text-stone-600 px-5 py-2.5 rounded-xl font-bold hover:bg-stone-200 transition text-sm disabled:opacity-50"
                >
                  <Loader2 size={16} className={loadingDigest ? 'animate-spin' : 'hidden'} />
                  Přegenerovat
                </button>
                <button
                  onClick={importDigestToEditor}
                  disabled={!digestData}
                  className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-purple-700 transition shadow-lg text-sm disabled:opacity-50"
                >
                  <Copy size={16} />
                  Načíst do editoru
                </button>
              </div>
            </div>

            {digestData ? (
              <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                <div className="mb-4 pb-4 border-b border-stone-200">
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Předmět:</span>
                  <div className="font-bold text-stone-900 text-lg mt-1">{digestData.subject}</div>
                </div>
                <div 
                  className="prose max-w-none bg-white p-8 rounded-xl border border-stone-200 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: digestData.html }}
                />
              </div>
            ) : (
              <div className="p-12 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400 font-bold">
                {loadingDigest ? 'Generuji souhrn...' : 'Digest není k dispozici. Zkuste ho přegenerovat.'}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
      />
    </div>
  );
}
