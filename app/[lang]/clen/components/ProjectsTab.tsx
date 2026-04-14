'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { FolderKanban, Plus, Send, X } from 'lucide-react';
import Dialog from '@/app/components/ui/Dialog';

export default function ProjectsTab({ lang }: { lang: string }) {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinOpen, setJoinOpen] = useState<null | { id: string; title: string }>(null);
  const [joinMessage, setJoinMessage] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createTags, setCreateTags] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');

      const res = await fetch('/api/projects/list', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setProjects(json.projects || []);
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setLoading(false);
    }
  }, [lang, showToast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const openProjects = useMemo(() => (projects || []).filter((p) => (p.status || 'open') === 'open'), [projects]);

  const submitJoin = async () => {
    if (!joinOpen) return;
    setJoinLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');

      const res = await fetch('/api/projects/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: joinOpen.id, message: joinMessage.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      showToast(lang === 'en' ? 'Request sent' : 'Žádost odeslána', 'success');
      setJoinOpen(null);
      setJoinMessage('');
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setJoinLoading(false);
    }
  };

  const submitCreate = async () => {
    if (!createTitle.trim() || !createDescription.trim()) {
      showToast(lang === 'en' ? 'Fill title and description' : 'Vyplňte název a popis', 'error');
      return;
    }
    setCreateLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error(lang === 'en' ? 'Unauthorized' : 'Nepřihlášen');

      const tags = createTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);

      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: createTitle.trim(), description: createDescription.trim(), tags }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');

      showToast(lang === 'en' ? 'Project created' : 'Projekt vytvořen', 'success');
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateTags('');
      await fetchProjects();
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[3rem] border border-stone-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              <FolderKanban className="text-green-600" />
              {lang === 'en' ? 'Projects' : 'Projekty'}
            </h2>
            <p className="text-stone-500 font-medium mt-2">
              {lang === 'en'
                ? 'Open initiatives where you can help.'
                : 'Otevřené iniciativy, do kterých se můžete zapojit.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition"
            >
              <Plus size={16} />
              {lang === 'en' ? 'New project' : 'Nový projekt'}
            </button>
            <button
              type="button"
              onClick={fetchProjects}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
            >
              {lang === 'en' ? 'Refresh' : 'Obnovit'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[3rem] border border-stone-100 shadow-sm">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : openProjects.length === 0 ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            {lang === 'en' ? 'No open projects yet.' : 'Zatím žádné otevřené projekty.'}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {openProjects.map((p) => (
              <div key={p.id} className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 text-lg">{p.title || 'Projekt'}</div>
                    <div className="mt-2 text-stone-600 font-medium leading-relaxed whitespace-pre-line">
                      {p.description || ''}
                    </div>
                    {Array.isArray(p.tags) && p.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {p.tags.slice(0, 10).map((t: string) => (
                          <span
                            key={t}
                            className="px-3 py-1 bg-white border border-stone-200 rounded-full text-[9px] font-black uppercase tracking-widest text-stone-500"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setJoinOpen({ id: String(p.id), title: p.title || 'Projekt' });
                      setJoinMessage('');
                    }}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                  >
                    <Send size={16} />
                    {lang === 'en' ? 'Join' : 'Zapojit se'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {joinOpen && (
        <Dialog
          open={!!joinOpen}
          onClose={() => setJoinOpen(null)}
          overlayClassName="fixed inset-0 z-[10003] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          panelClassName="relative w-full max-w-lg bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden"
        >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
                  {lang === 'en' ? 'Join request' : 'Žádost o zapojení'}
                </div>
                <div className="font-black text-stone-900 truncate">{joinOpen.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setJoinOpen(null)}
                className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400"
                aria-label="Zavřít"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-5">
              <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                  {lang === 'en' ? 'Message (optional)' : 'Zpráva (volitelné)'}
                </div>
                <textarea
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                  rows={4}
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition resize-none"
                  placeholder={lang === 'en' ? 'How can you help?' : 'S čím můžete pomoct?'}
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={submitJoin}
                  disabled={joinLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  {joinLoading ? <InlinePulse className="bg-white/80" size={14} /> : <Send size={16} />}
                  {lang === 'en' ? 'Send' : 'Odeslat'}
                </button>
                <button
                  type="button"
                  onClick={() => setJoinOpen(null)}
                  disabled={joinLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  {lang === 'en' ? 'Cancel' : 'Zrušit'}
                </button>
              </div>
            </div>
        </Dialog>
      )}

      {createOpen && (
        <Dialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          overlayClassName="fixed inset-0 z-[10003] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          panelClassName="relative w-full max-w-2xl bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden"
        >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
                  {lang === 'en' ? 'New project' : 'Nový projekt'}
                </div>
                <div className="font-black text-stone-900 truncate">
                  {lang === 'en' ? 'Create' : 'Vytvořit'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400"
                aria-label="Zavřít"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                  {lang === 'en' ? 'Title' : 'Název'}
                </div>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                  {lang === 'en' ? 'Description' : 'Popis'}
                </div>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  rows={5}
                  className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
                />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                  {lang === 'en' ? 'Tags (comma separated)' : 'Tagy (oddělené čárkou)'}
                </div>
                <input
                  value={createTags}
                  onChange={(e) => setCreateTags(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                  placeholder={lang === 'en' ? 'design, web, events' : 'design, web, akce'}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={createLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  {createLoading ? <InlinePulse className="bg-white/80" size={14} /> : <Plus size={16} />}
                  {lang === 'en' ? 'Create' : 'Vytvořit'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={createLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  {lang === 'en' ? 'Cancel' : 'Zrušit'}
                </button>
              </div>
            </div>
        </Dialog>
      )}
    </div>
  );
}
