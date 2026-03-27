'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus, Save, Search, X, CheckCircle } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import { logAdminAction } from '@/lib/admin-logger';
import Portal from '@/app/components/ui/Portal';

export default function ProjectsTab({
  currentUser,
  userProfile,
}: {
  currentUser: any;
  userProfile: any;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', tags: '' });
  const [editOpen, setEditOpen] = useState<null | { id: string; details: any }>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['admin_projects'],
    queryFn: async () => {
      const res = await supabase
        .from('admin_logs')
        .select('id, created_at, details')
        .eq('action', 'PROJECT')
        .order('created_at', { ascending: false })
        .limit(300);
      if (res.error) throw res.error;
      return res.data || [];
    },
  });

  const { data: joins = [] } = useQuery({
    queryKey: ['admin_project_joins'],
    queryFn: async () => {
      const res = await supabase
        .from('admin_logs')
        .select('id, created_at, target_id, details')
        .eq('action', 'PROJECT:join')
        .order('created_at', { ascending: false })
        .limit(500);
      if (res.error) throw res.error;
      return res.data || [];
    },
  });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (projects || []).filter((p: any) => {
      const d = p.details || {};
      if ((d.kind || 'project') !== 'project') return false;
      if (!query) return true;
      const hay = `${d.title || ''} ${d.description || ''} ${(d.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(query);
    });
  }, [projects, q]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);

      const payload = {
        kind: 'project',
        title: form.title.trim(),
        description: form.description.trim(),
        tags,
        status: 'open',
        createdBy: { id: currentUser?.id, email: currentUser?.email },
        updatedAt: new Date().toISOString(),
      };

      const res = await supabase
        .from('admin_logs')
        .insert([
          {
            admin_email: currentUser?.email,
            admin_name: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined,
            action: 'PROJECT',
            target_id: null,
            details: payload,
          },
        ])
        .select('id')
        .single();
      if (res.error) throw res.error;

      try {
        await logAdminAction(
          currentUser?.email,
          `PROJECT:create ${res.data?.id}`,
          String(res.data?.id),
          payload,
          userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined
        );
      } catch {}
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_projects'] });
      showToast('Projekt vytvořen', 'success');
      setCreateOpen(false);
      setForm({ title: '', description: '', tags: '' });
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nextDetails }: { id: string; nextDetails: any }) => {
      const res = await supabase.from('admin_logs').update({ details: nextDetails }).eq('id', id);
      if (res.error) throw res.error;
      try {
        await logAdminAction(
          currentUser?.email,
          `PROJECT:update ${id}`,
          id,
          nextDetails,
          userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined
        );
      } catch {}
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_projects'] });
      showToast('Uloženo', 'success');
      setEditOpen(null);
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const joinByProject = useMemo(() => {
    const map = new Map<string, any[]>();
    (joins || []).forEach((j: any) => {
      const pid = String(j.target_id || j.details?.projectId || '');
      if (!pid) return;
      const arr = map.get(pid) || [];
      arr.push(j);
      map.set(pid, arr);
    });
    return map;
  }, [joins]);

  const openEdit = (p: any) => {
    setEditOpen({ id: String(p.id), details: p.details || {} });
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
              <FolderKanban className="text-green-600" />
              Projekty
            </h2>
            <p className="text-stone-500 font-medium">Jednoduchá správa projektů a žádostí o zapojení.</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition"
          >
            <Plus size={16} />
            Nový projekt
          </button>
        </div>

        <div className="mt-8 relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hledat…"
            className="w-full bg-stone-50 border-none rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <InlinePulse className="bg-stone-200" size={18} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
            Žádné projekty.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.slice(0, 200).map((p: any) => {
              const d = p.details || {};
              const joinCount = (joinByProject.get(String(p.id)) || []).length;
              return (
                <div key={p.id} className="p-6 bg-stone-50 rounded-[2rem] border border-stone-100">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-black text-stone-900 text-lg">{d.title || 'Projekt'}</div>
                      <div className="mt-2 text-stone-600 font-medium leading-relaxed whitespace-pre-line">{d.description || ''}</div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 bg-white border border-stone-200 rounded-full text-[9px] font-black uppercase tracking-widest text-stone-500">
                          {(d.status || 'open').toUpperCase()}
                        </span>
                        <span className="px-3 py-1 bg-white border border-stone-200 rounded-full text-[9px] font-black uppercase tracking-widest text-stone-500">
                          join: {joinCount}
                        </span>
                        {(d.tags || []).slice(0, 8).map((t: string) => (
                          <span key={t} className="px-3 py-1 bg-white border border-stone-200 rounded-full text-[9px] font-black uppercase tracking-widest text-stone-500">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                    >
                      <Save size={16} />
                      Upravit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {createOpen && (
        <Portal>
        <div className="fixed inset-0 z-[10003] flex items-center justify-center p-6">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCreateOpen(false)} aria-label="Zavřít" />
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="font-black text-stone-900">Nový projekt</div>
              <button type="button" onClick={() => setCreateOpen(false)} className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400" aria-label="Zavřít">
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Název"
                className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Popis"
                rows={5}
                className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
              />
              <input
                value={form.tags}
                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                placeholder="Tagy (oddělené čárkou)"
                className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !form.title.trim() || !form.description.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  {createMutation.isPending ? <InlinePulse className="bg-white/80" size={14} /> : <CheckCircle size={16} />}
                  Vytvořit
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                >
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {editOpen && (
        <Portal>
        <div className="fixed inset-0 z-[10003] flex items-center justify-center p-6">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditOpen(null)} aria-label="Zavřít" />
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="font-black text-stone-900">Upravit projekt</div>
              <button type="button" onClick={() => setEditOpen(null)} className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400" aria-label="Zavřít">
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <input
                value={editOpen.details?.title || ''}
                onChange={(e) => setEditOpen((p) => (p ? { ...p, details: { ...p.details, title: e.target.value } } : p))}
                className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
              />
              <textarea
                value={editOpen.details?.description || ''}
                onChange={(e) => setEditOpen((p) => (p ? { ...p, details: { ...p.details, description: e.target.value } } : p))}
                rows={6}
                className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
              />
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  value={Array.isArray(editOpen.details?.tags) ? editOpen.details.tags.join(', ') : ''}
                  onChange={(e) =>
                    setEditOpen((p) =>
                      p
                        ? {
                            ...p,
                            details: {
                              ...p.details,
                              tags: e.target.value
                                .split(',')
                                .map((t) => t.trim())
                                .filter(Boolean)
                                .slice(0, 12),
                            },
                          }
                        : p
                    )
                  }
                  placeholder="Tagy"
                  className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                />
                <select
                  value={editOpen.details?.status || 'open'}
                  onChange={(e) => setEditOpen((p) => (p ? { ...p, details: { ...p.details, status: e.target.value } } : p))}
                  className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                >
                  <option value="open">open</option>
                  <option value="paused">paused</option>
                  <option value="done">done</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    updateMutation.mutate({
                      id: editOpen.id,
                      nextDetails: { ...(editOpen.details || {}), updatedAt: new Date().toISOString() },
                    })
                  }
                  disabled={updateMutation.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  {updateMutation.isPending ? <InlinePulse className="bg-white/80" size={14} /> : <Save size={16} />}
                  Uložit
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(null)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                >
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
