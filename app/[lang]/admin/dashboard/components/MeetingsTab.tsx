'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Trash2, Calendar, MapPin, Loader2, Save, X, Edit3, CheckCircle, Sparkles } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import dynamic from 'next/dynamic';
import ConfirmModal from '@/app/components/ConfirmModal';
import { richTextToClientHtml } from '@/lib/richtext-client';
import { SkeletonTabContent } from '../../../components/Skeleton';
import { summarizeHtmlToBullets } from '@/lib/ai/pilot';

const Editor = dynamic(() => import('../../../components/Editor'), { 
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200" />
});

export default function MeetingsTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [q, setQ] = useState('');
  const [formData, setFormData] = useState({ title: '', date: '', location: '', minutes: '' });
  const [agenda, setAgenda] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const handleEdit = (meeting: any) => {
    setEditingItem(meeting);
    setFormData({
      title: meeting.title || '',
      date: meeting.date ? new Date(meeting.date).toISOString().slice(0, 16) : '',
      location: meeting.location || '',
      minutes: meeting.minutes || ''
    });
    setAgenda(agendaById.get(String(meeting.id)) || '');
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingItem(null);
    setFormData({ title: '', date: '', location: '', minutes: '' });
    setAgenda('');
  };

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['admin_meetings'],
    queryFn: async () => {
      const { data } = await supabase.from('meetings').select('*').order('date', { ascending: false });
      return data || [];
    }
  });

  const filteredMeetings = useMemo(() => {
    const query = String(q || '').trim().toLowerCase();
    if (!query) return meetings;
    return meetings.filter((m: any) => {
      const hay = [m?.title, m?.location, m?.date]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return hay.includes(query);
    });
  }, [meetings, q]);

  const ids = meetings.map((m: any) => String(m.id));

  const { data: meetingMeta = [] } = useQuery({
    queryKey: ['admin_meeting_meta', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_logs')
        .select('target_id, action, created_at, details, admin_email, admin_name')
        .in('action', ['MEETING_AGENDA', 'MEETING_MINUTES_APPROVED', 'MEETING_SUMMARY'])
        .in('target_id', ids)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const agendaById = (() => {
    const map = new Map<string, string>();
    for (const row of meetingMeta as any[]) {
      if (row.action !== 'MEETING_AGENDA') continue;
      const id = String(row.target_id || '');
      if (!id || map.has(id)) continue;
      const a = row.details?.agenda ? String(row.details.agenda) : '';
      map.set(id, a);
    }
    return map;
  })();

  const approvalById = (() => {
    const map = new Map<string, any>();
    for (const row of meetingMeta as any[]) {
      if (row.action !== 'MEETING_MINUTES_APPROVED') continue;
      const id = String(row.target_id || '');
      if (!id || map.has(id)) continue;
      map.set(id, row);
    }
    return map;
  })();

  const summaryById = (() => {
    const map = new Map<string, any>();
    for (const row of meetingMeta as any[]) {
      if (row.action !== 'MEETING_SUMMARY') continue;
      const id = String(row.target_id || '');
      if (!id || map.has(id)) continue;
      map.set(id, row);
    }
    return map;
  })();

  const saveMutation = useMutation({
    mutationFn: async ({ newData, agendaText }: { newData: any; agendaText: string }) => {
      let meetingId = editingItem ? String(editingItem.id) : '';
      if (editingItem) {
        const { error } = await supabase.from('meetings').update(newData).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('meetings').insert([newData]).select('id').single();
        if (error) throw error;
        meetingId = String(data?.id);
      }

      if (meetingId && agendaText.trim()) {
        const { error } = await supabase.from('admin_logs').insert([
          {
            admin_email: 'meeting',
            admin_name: 'Agenda',
            action: 'MEETING_AGENDA',
            target_id: meetingId,
            details: { agenda: agendaText, updatedAt: new Date().toISOString() },
          },
        ]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_meetings'] });
      queryClient.invalidateQueries({ queryKey: ['admin_meeting_meta'] });
      showToast(editingItem ? 'Zápis ze schůze upraven' : 'Zápis ze schůze uložen', 'success');
      handleCancel();
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_meetings'] });
      showToast('Zápis smazán', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat zápis?',
      message: 'Opravdu chcete tento zápis ze schůze trvale smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const approveMutation = useMutation({
    mutationFn: async (meeting: any) => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email || 'admin';
      const meetingId = String(meeting.id);
      const agendaText = agendaById.get(meetingId) || '';
      const { error } = await supabase.from('admin_logs').insert([
        {
          admin_email: email,
          admin_name: 'Meeting',
          action: 'MEETING_MINUTES_APPROVED',
          target_id: meetingId,
          details: {
            meetingId,
            agenda: agendaText,
            minutes: meeting.minutes || '',
            approvedAt: new Date().toISOString(),
          },
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_meeting_meta'] });
      showToast('Zápis schválen', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  const summarizeMutation = useMutation({
    mutationFn: async (meeting: any) => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email || 'admin';
      const meetingId = String(meeting.id);
      const agendaText = agendaById.get(meetingId) || '';
      const { bullets } = summarizeHtmlToBullets(meeting.minutes || '');
      const esc = (s: string) =>
        String(s || '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      const summaryHtml = bullets.length ? `<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '<p>—</p>';

      const { error } = await supabase.from('admin_logs').insert([
        {
          admin_email: email,
          admin_name: 'Meeting',
          action: 'MEETING_SUMMARY',
          target_id: meetingId,
          details: {
            meetingId,
            agenda: agendaText,
            bullets,
            summaryHtml,
            minutesLen: String(meeting.minutes || '').length,
            createdAt: new Date().toISOString(),
          },
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_meeting_meta'] });
      showToast('Shrnutí uloženo', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error'),
  });

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Users className="text-green-600" />
          {dict.admin.tabMeetings}
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-white border border-stone-200 rounded-2xl px-5 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 outline-none transition w-full sm:w-[320px]"
            placeholder={dict.admin.searchPlaceholder || 'Vyhledat…'}
          />
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
          >
            {isAdding ? <X size={20} /> : <Plus size={20} />}
            {isAdding ? 'Zrušit' : 'Nový zápis'}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název schůze</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. Plenární schůze březen 2026"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Datum a čas</label>
              <input 
                type="datetime-local" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Místo</label>
              <input 
                type="text" 
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Klubovna / Teams"
              />
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between gap-4 mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 block">Program schůze</label>
              <button
                type="button"
                onClick={() => {
                  if (agenda.trim()) return;
                  setAgenda('1) Zahájení\n2) Informace\n3) Rozhodnutí\n4) Závěr');
                }}
                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
              >
                Šablona
              </button>
            </div>
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={4}
              className="w-full bg-stone-50 border-none rounded-xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none resize-none"
              placeholder="Body programu…"
            />
          </div>
          
          <div className="mb-8">
            <div className="flex items-center justify-between gap-4 mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1 block">Zápis (Minuty)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if ((formData.minutes || '').trim()) return;
                    setFormData((p) => ({
                      ...p,
                      minutes:
                        '<h2>Účast</h2><ul><li></li></ul><h2>Program</h2><ul><li></li></ul><h2>Rozhodnutí</h2><ul><li></li></ul><h2>Úkoly</h2><ul><li></li></ul>',
                    }));
                  }}
                  className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                >
                  Šablona
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, minutes: '' }))}
                  className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                >
                  Vymazat
                </button>
              </div>
            </div>
            <Editor value={formData.minutes} onChange={val => setFormData({...formData, minutes: val})} />
          </div>

          <button 
            onClick={() => saveMutation.mutate({ newData: formData, agendaText: agenda })}
            disabled={!formData.title || !formData.date || saveMutation.isPending}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
            {editingItem ? 'Aktualizovat zápis' : 'Uložit zápis'}
          </button>
        </div>
      )}

      <div className="grid gap-6">
        {meetings.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Žádné zápisy ze schůzí</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Žádné výsledky</p>
          </div>
        ) : (
          filteredMeetings.map((meeting: any) => (
            <div key={meeting.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm group transition hover:shadow-xl">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-grow">
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                    <span className="flex items-center gap-1.5"><Calendar size={12} /> {new Date(meeting.date).toLocaleString()}</span>
                    <span className="flex items-center gap-1.5"><MapPin size={12} /> {meeting.location}</span>
                    {(() => {
                      const meetingId = String(meeting.id);
                      const approval = approvalById.get(meetingId);
                      const approvedMinutes = approval?.details?.minutes ? String(approval.details.minutes) : '';
                      const isApproved = !!approval && approvedMinutes === (meeting.minutes || '');
                      return (
                        <span className={`px-3 py-1 rounded-full ${isApproved ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                          {isApproved ? 'approved' : 'draft'}
                        </span>
                      );
                    })()}
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 mb-4">{meeting.title}</h3>

                  {agendaById.get(String(meeting.id)) && (
                    <div className="text-sm font-bold text-stone-700 bg-stone-50 p-6 rounded-2xl border border-stone-100 mb-4 whitespace-pre-line">
                      {agendaById.get(String(meeting.id))}
                    </div>
                  )}

                  {(() => {
                    const summary = summaryById.get(String(meeting.id));
                    const html = summary?.details?.summaryHtml ? String(summary.details.summaryHtml) : '';
                    if (!html) return null;
                    return (
                      <div className="text-sm font-bold text-stone-700 bg-green-50 p-6 rounded-2xl border border-green-100 mb-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-green-700 mb-3">Shrnutí</div>
                        <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: richTextToClientHtml(html) }} />
                      </div>
                    );
                  })()}
                  
                  <div
                    className="prose prose-stone max-w-none text-stone-600 text-sm bg-stone-50 p-6 rounded-2xl border border-stone-100"
                    dangerouslySetInnerHTML={{ __html: richTextToClientHtml(String(meeting.minutes || '')) }}
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => summarizeMutation.mutate(meeting)}
                    disabled={summarizeMutation.isPending}
                    className="p-4 bg-amber-50 text-amber-700 rounded-2xl hover:bg-amber-600 hover:text-white transition shadow-sm disabled:opacity-50"
                  >
                    {summarizeMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(meeting)}
                    disabled={approveMutation.isPending}
                    className="p-4 bg-green-50 text-green-700 rounded-2xl hover:bg-green-600 hover:text-white transition shadow-sm disabled:opacity-50"
                  >
                    {approveMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                  </button>
                  <button 
                    onClick={() => handleEdit(meeting)}
                    className="p-4 bg-stone-50 text-stone-600 rounded-2xl hover:bg-stone-900 hover:text-white transition shadow-sm"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button 
                    onClick={() => deleteItem(meeting.id)}
                    className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition shadow-sm"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
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
