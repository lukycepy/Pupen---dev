'use client';

import React from 'react';
import { supabase } from '@/lib/supabase';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Trash2, Mail, Clock, Download } from 'lucide-react';
import ConfirmModal from '@/app/components/ConfirmModal';

interface MessagesTabProps {
  dict: any;
  readOnly?: boolean;
}

const PAGE_SIZE = 40;

export default function MessagesTab({ dict, readOnly = false }: MessagesTabProps) {
  const queryClient = useQueryClient();
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages_paged'] });
    },
    onError: (err: any) => {
      alert('Error: ' + err.message);
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

  const exportNewsletter = async () => {
    const { data, error } = await supabase.from('newsletter').select('email, created_at');
    if (error) return alert(error.message);
    if (!data || data.length === 0) return alert('Žádní odběratelé');

    const csv = [
      ['Email', 'Datum přihlášení'],
      ...data.map(n => [n.email, new Date(n.created_at).toLocaleString()])
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `newsletter-emails.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <p className="text-sm text-stone-500">{messages.length} {dict.admin.messagesCountText}</p>
          </div>
        </div>
        <button 
          onClick={exportNewsletter}
          className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg"
        >
          <Download size={18} />
          {dict.admin.btnExportNewsletter}
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
                  <div className="w-10 h-10 bg-stone-50 rounded-full flex items-center justify-center text-stone-400 font-bold border border-stone-100 uppercase">
                    {msg.name?.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 leading-tight">{msg.name}</h3>
                    <a href={`mailto:${msg.email}`} className="text-xs text-stone-400 hover:text-green-600 transition flex items-center gap-1">
                      <Mail size={12} /> {msg.email}
                    </a>
                  </div>
                </div>
                <a 
                  href={`mailto:${msg.email}?subject=Re: ${msg.subject || 'Zpráva z webu Pupen'}`}
                  className="bg-green-50 text-green-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all shadow-sm"
                >
                  Odpovědět
                </a>
              </div>

              <div className="bg-stone-50 p-4 rounded-xl mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{dict.admin.labelSubject}</p>
                <p className="font-bold text-stone-700">{msg.subject || dict.admin.noSubject}</p>
              </div>

              <p className="text-stone-600 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
                {msg.message}
              </p>

              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-stone-300 pt-4 border-t border-stone-50">
                <span className="flex items-center gap-1">
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
