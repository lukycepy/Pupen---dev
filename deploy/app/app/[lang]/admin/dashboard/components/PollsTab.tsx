'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, CheckCircle, Plus, Save, Trash2, X } from 'lucide-react';
import InlinePulse from '@/app/components/InlinePulse';
import { useToast } from '@/app/context/ToastContext';
import Dialog from '@/app/components/ui/Dialog';

export default function PollsTab({ dict }: { dict: any }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    question: '',
    question_en: '',
    options: [''],
    options_en: [''],
    is_active: true,
  });
  const [selected, setSelected] = useState<any>(null);

  const { data: polls = [], isLoading } = useQuery({
    queryKey: ['admin_polls'],
    queryFn: async () => {
      const res = await supabase
        .from('polls')
        .select('*, poll_options(*)')
        .order('created_at', { ascending: false });
      if (res.error) throw res.error;
      return res.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const q = form.question.trim();
      if (!q) throw new Error('Chybí otázka');
      const opts = form.options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) throw new Error('Min. 2 možnosti');

      const pollRes = await supabase
        .from('polls')
        .insert([
          {
            question: q,
            question_en: form.question_en.trim() || null,
            is_active: !!form.is_active,
          },
        ])
        .select('id')
        .single();
      if (pollRes.error) throw pollRes.error;

      const pollId = pollRes.data.id;
      const optRows = opts.map((o, idx) => ({
        poll_id: pollId,
        option_text: o,
        option_text_en: (form.options_en[idx] || '').trim() || null,
        votes: 0,
      }));
      const optRes = await supabase.from('poll_options').insert(optRows);
      if (optRes.error) throw optRes.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_polls'] });
      showToast('Anketa vytvořena', 'success');
      setCreateOpen(false);
      setForm({ question: '', question_en: '', options: [''], options_en: [''], is_active: true });
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await supabase.from('polls').update({ is_active: isActive }).eq('id', id);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_polls'] }),
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const deletePollMutation = useMutation({
    mutationFn: async (id: string) => {
      const opts = await supabase.from('poll_options').delete().eq('poll_id', id);
      if (opts.error) throw opts.error;
      const res = await supabase.from('polls').delete().eq('id', id);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_polls'] });
      showToast('Smazáno', 'success');
      setSelected(null);
    },
    onError: (e: any) => showToast(e?.message || 'Chyba', 'error'),
  });

  const totalVotes = useMemo(() => {
    const p = selected;
    if (!p?.poll_options) return 0;
    return p.poll_options.reduce((acc: number, o: any) => acc + (o.votes || 0), 0);
  }, [selected]);

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
              <BarChart3 className="text-green-600" />
              {dict?.admin?.tabPolls || 'Ankety'}
            </h2>
            <p className="text-stone-500 font-medium">Správa anket a výsledků.</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition"
          >
            <Plus size={16} />
            Nová anketa
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
          <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="py-16 flex items-center justify-center">
                <InlinePulse className="bg-stone-200" size={18} />
              </div>
            ) : polls.length === 0 ? (
              <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">Žádné ankety.</div>
            ) : (
              <div className="space-y-3">
                {polls.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p)}
                    className={`w-full text-left p-5 rounded-[2rem] border transition ${
                      selected?.id === p.id ? 'bg-green-50 border-green-200' : 'bg-stone-50 border-stone-100 hover:bg-stone-100'
                    }`}
                  >
                    <div className="font-black text-stone-900">{p.question}</div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                      {p.is_active ? 'active' : 'inactive'} • {p.poll_options?.length || 0} options
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            {!selected ? (
              <div className="py-16 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                Vyberte anketu.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Otázka</div>
                    <div className="text-xl font-black text-stone-900">{selected.question}</div>
                    {selected.question_en && <div className="mt-1 text-stone-600 font-medium">{selected.question_en}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate({ id: selected.id, isActive: !selected.is_active })}
                      disabled={toggleMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                    >
                      {toggleMutation.isPending ? <InlinePulse className="bg-stone-300" size={12} /> : <Save size={16} />}
                      {selected.is_active ? 'Deaktivovat' : 'Aktivovat'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePollMutation.mutate(selected.id)}
                      disabled={deletePollMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-red-200 bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
                    >
                      {deletePollMutation.isPending ? <InlinePulse className="bg-white/80" size={12} /> : <Trash2 size={16} />}
                      Smazat
                    </button>
                  </div>
                </div>

                <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
                    Výsledky • {totalVotes} hlasů
                  </div>
                  <div className="space-y-3">
                    {(selected.poll_options || []).map((o: any) => {
                      const pct = totalVotes > 0 ? Math.round(((o.votes || 0) / totalVotes) * 100) : 0;
                      return (
                        <div key={o.id} className="bg-white border border-stone-200 rounded-2xl p-4 relative overflow-hidden">
                          <div className="absolute inset-y-0 left-0 bg-green-100/60" style={{ width: `${pct}%` }} />
                          <div className="relative flex items-center justify-between gap-3">
                            <div className="font-bold text-stone-900">
                              {o.option_text}
                              {o.option_text_en && <span className="text-stone-400 font-black text-[10px] uppercase tracking-widest"> • {o.option_text_en}</span>}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                              {pct}% • {o.votes || 0}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {createOpen && (
        <Dialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          overlayClassName="fixed inset-0 z-[10003] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          panelClassName="relative w-full max-w-2xl bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="font-black text-stone-900">Nová anketa</div>
              <button type="button" onClick={() => setCreateOpen(false)} className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400" aria-label="Zavřít">
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Otázka (CZ)</div>
                <input
                  value={form.question}
                  onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))}
                  className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Question (EN)</div>
                <input
                  value={form.question_en}
                  onChange={(e) => setForm((p) => ({ ...p, question_en: e.target.value }))}
                  className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Možnosti (CZ)</div>
                  {form.options.map((v, idx) => (
                    <input
                      key={idx}
                      value={v}
                      onChange={(e) =>
                        setForm((p) => {
                          const next = [...p.options];
                          next[idx] = e.target.value;
                          return { ...p, options: next };
                        })
                      }
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                      placeholder={`Možnost ${idx + 1}`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, options: [...p.options, ''], options_en: [...p.options_en, ''] }))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-700 hover:bg-stone-50 transition"
                  >
                    + Přidat možnost
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Options (EN)</div>
                  {form.options_en.map((v, idx) => (
                    <input
                      key={idx}
                      value={v}
                      onChange={(e) =>
                        setForm((p) => {
                          const next = [...p.options_en];
                          next[idx] = e.target.value;
                          return { ...p, options_en: next };
                        })
                      }
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                      placeholder={`Option ${idx + 1}`}
                    />
                  ))}
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 px-1">
                    EN může být prázdné.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
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
        </Dialog>
      )}
    </div>
  );
}
