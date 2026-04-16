'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Check, X, Trash2, Eye, User, Clock, Search, ShieldCheck } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

export default function BlogTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['admin_blog_posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_blog')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('student_blog').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_blog_posts'] });
      showToast(dict.admin.alertStatusUpdated || 'Stav článku aktualizován', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('student_blog').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_blog_posts'] });
      showToast('Článek smazán', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat článek?',
      message: 'Opravdu chcete tento příspěvek z blogu smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const filteredPosts = posts.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.author_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <FileText className="text-green-600" />
          {dict.admin.tabBlog}
        </h2>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="Hledat v blogu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-3 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 transition w-full md:w-64 font-medium"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredPosts.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Žádné články k zobrazení</p>
          </div>
        ) : (
          filteredPosts.map((post: any) => (
            <div key={post.id} className="bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl hover:border-green-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    {post.status !== 'published' && (
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                        Stav: {post.status}
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center gap-1">
                      <Clock size={10} /> {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 mb-1 group-hover:text-green-600 transition">{post.title}</h3>
                  <div className="flex items-center gap-4 text-stone-400 text-sm font-medium">
                    <span className="flex items-center gap-1.5"><User size={14} /> {post.author_name}</span>
                    {post.profiles && (
                      <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck size={10} /> Ověřený člen: {post.profiles.first_name} {post.profiles.last_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5"><Eye size={14} /> {post.views} zobrazení</span>
                  </div>
                  <div className="mt-4 text-stone-600 text-sm line-clamp-2 bg-stone-50 p-4 rounded-xl italic">
                    {post.content}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {post.status !== 'published' ? (
                    <button 
                      onClick={() => approveMutation.mutate({ id: post.id, status: 'published' })}
                      className="p-4 bg-green-50 text-green-600 rounded-2xl hover:bg-green-600 hover:text-white transition shadow-sm"
                      title="Schválit a publikovat"
                    >
                      <Check size={20} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => approveMutation.mutate({ id: post.id, status: 'pending' })}
                      className="p-4 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-600 hover:text-white transition shadow-sm"
                      title="Vrátit do čekajících"
                    >
                      <X size={20} />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteItem(post.id)}
                    className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition shadow-sm"
                    title="Smazat"
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
