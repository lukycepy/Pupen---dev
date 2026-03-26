'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Trash2, Mail, Clock, Download, Tag, CheckCircle, Clock3, User } from 'lucide-react';
import ConfirmModal from '@/app/components/ConfirmModal';
import { useToast } from '@/app/context/ToastContext';

interface MessagesTabProps {
  dict: any;
  readOnly?: boolean;
}

const PAGE_SIZE = 40;

const availableTags = ['dotaz', 'stížnost', 'spolupráce', 'spam', 'urgentní', 'finance', 'členství'];

export default function MessagesTab({ dict, readOnly = false }: MessagesTabProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalConfig, setModalConfig] = React.useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: ['messages_paged'],
    queryFn: async ({ pageParam }) => {
      const from = typeof pageParam === 'number' ? pageParam : 0;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase.from('messages').select('*').order('created_at', { ascending: false }).range(from, to);
      if (res.error) throw res.error;
      const items = res.data || [];
      return { items, nextFrom: items.length === PAGE_SIZE ? to + 1 : null };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextFrom,
  });

  const messages = (messagesQuery.data?.pages || []).flatMap((p) => p.items);

  const countQuery = useQuery({
    queryKey: ['messages_count'],
    queryFn: async () => {
      const res = await supabase.from('messages').select('*', { count: 'exact', head: true });
      if (res.error) throw res.error;
      return Number(res.count || 0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages_paged'] });
    },
    onError: (err: any) => {
      showToast(err?.message || 'Chyba', 'error');
    }
  });

  const { data: admins = [] } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const res = await supabase.from('profiles').select('id, email, first_name, last_name').eq('is_admin', true);
      return res.data || [];
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages_paged'] });
    },
    onError: (err: any) => {
      showToast(err?.message || 'Chyba', 'error');
    }
  });

  const deleteMessage = (id: string) => {
    setModalConfig({
      title: 'Smazat zprávu?',
      message: 'Opravdu chcete tuto zprávu smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const escapeCsv = (value: any) => {
    const s = String(value ?? '');
    if (/[\n\r",]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const exportMessages = async () => {
    try {
      const res = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(1000);
      if (res.error) throw res.error;
      const items = res.data || [];
      if (items.length === 0) return;
      const rows = [
        ['created_at', 'name', 'email', 'subject', 'message'],
        ...items.map((m: any) => [m.created_at, m.name, m.email, m.subject, m.message]),
      ];
      const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `inbox_messages_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Export hotový', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Chyba exportu', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl">
            <Mail size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">{dict.admin.tabMessages}</h2>
            <p className="text-sm text-stone-500">{(countQuery.data ?? messages.length)} {dict.admin.messagesCountText}</p>
          </div>
        </div>
        <button 
          onClick={exportMessages}
          className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg"
        >
          <Download size={18} />
          {dict.admin?.btnExportCsv || 'Export CSV'}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {messages.length === 0 ? (
          <div className="md:col-span-2 text-center py-20 bg-white rounded-2xl border border-dashed border-stone-200">
            <MessageSquare className="mx-auto text-stone-200 mb-4" size={48} />
            <p className="text-stone-400 font-bold">{dict.admin.emptyInbox}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition group relative">
              {!readOnly && (
                <button 
                  onClick={() => deleteMessage(msg.id)}
                  className="absolute top-4 right-4 p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                  title={dict.admin.deleteTooltip}
                >
                  <Trash2 size={18} />
                </button>
              )}

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border uppercase ${
                    msg.status === 'closed' ? 'bg-stone-100 text-stone-400 border-stone-200' :
                    msg.status === 'in_progress' ? 'bg-amber-50 text-amber-500 border-amber-200' :
                    'bg-green-50 text-green-600 border-green-200'
                  }`}>
                    {msg.name?.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 leading-tight flex items-center gap-2">
                      {msg.name}
                      {msg.status === 'closed' && <CheckCircle size={14} className="text-stone-400" />}
                    </h3>
                    <a href={`mailto:${msg.email}`} className="text-xs text-stone-400 hover:text-green-600 transition flex items-center gap-1">
                      <Mail size={12} /> {msg.email}
                    </a>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <select
                    value={msg.status || 'open'}
                    onChange={(e) => updateMutation.mutate({ id: msg.id, data: { status: e.target.value } })}
                    className="text-[10px] font-black uppercase tracking-widest bg-stone-50 border-none rounded-lg px-2 py-1 outline-none cursor-pointer"
                  >
                    <option value="open">Otevřeno</option>
                    <option value="in_progress">Řeší se</option>
                    <option value="closed">Uzavřeno</option>
                  </select>
                  <a 
                    href={`mailto:${msg.email}?subject=Re: ${msg.subject || 'Zpráva z webu Pupen'}`}
                    className="bg-stone-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition-all shadow-sm"
                  >
                    Odpovědět
                  </a>
                </div>
              </div>

              <div className="bg-stone-50 p-4 rounded-xl mb-4 border border-stone-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{dict.admin.labelSubject}</p>
                <p className="font-bold text-stone-700">{msg.subject || dict.admin.noSubject}</p>
              </div>

              <p className="text-stone-600 text-sm leading-relaxed mb-6 whitespace-pre-wrap pl-2 border-l-2 border-stone-100">
                {msg.message}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-stone-50">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-stone-400" />
                    <select
                      value={msg.assigned_to || ''}
                      onChange={(e) => updateMutation.mutate({ id: msg.id, data: { assigned_to: e.target.value || null } })}
                      className="text-xs text-stone-600 bg-transparent outline-none cursor-pointer hover:bg-stone-50 rounded px-1"
                    >
                      <option value="">-- Nepřiřazeno --</option>
                      {admins.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.first_name} {a.last_name || a.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag size={14} className="text-stone-400" />
                    {msg.tags?.map((t: string) => (
                      <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                        onClick={() => updateMutation.mutate({ id: msg.id, data: { tags: msg.tags.filter((x: string) => x !== t) } })}
                      >
                        {t} &times;
                      </span>
                    ))}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value && !msg.tags?.includes(e.target.value)) {
                          updateMutation.mutate({ id: msg.id, data: { tags: [...(msg.tags || []), e.target.value] } });
                        }
                      }}
                      className="text-[10px] bg-transparent text-stone-400 font-bold uppercase outline-none cursor-pointer"
                    >
                      <option value="">+ Tag</option>
                      {availableTags.filter(t => !msg.tags?.includes(t)).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-300">
                  <Clock size={12} /> {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {messagesQuery.hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => messagesQuery.fetchNextPage()}
            disabled={messagesQuery.isFetchingNextPage}
            className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
          >
            {messagesQuery.isFetchingNextPage ? (dict.admin.btnLoading || 'Načítám...') : (dict.admin.btnMore || 'Načíst další')}
          </button>
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
