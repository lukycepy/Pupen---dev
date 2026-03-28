'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus, Trash2, ExternalLink, Loader2, Save, X, Building2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import dynamic from 'next/dynamic';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';
import { richTextToClientHtml } from '@/lib/richtext-client';
import { stripHtmlToText } from '@/lib/richtext-shared';

const Editor = dynamic(() => import('../../../components/Editor'), { 
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200" />
});

export default function JobsTab({ dict }: { dict: any }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', company: '', description: '', link: '', is_active: true, expires_at: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin_jobs'],
    queryFn: async () => {
      const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newData: any) => {
      const { error } = await supabase.from('jobs').insert([newData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_jobs'] });
      showToast('Pracovní nabídka přidána', 'success');
      setIsAdding(false);
      setFormData({ title: '', company: '', description: '', link: '', is_active: true, expires_at: '' });
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from('jobs').update({ is_active: status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_jobs'] });
      showToast('Stav nabídky aktualizován', 'success');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_jobs'] });
      showToast('Nabídka smazána', 'success');
    }
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat nabídku?',
      message: 'Opravdu chcete tuto pracovní nabídku trvale smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Briefcase className="text-green-600" />
          {dict.admin.tabJobs}
        </h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
          {isAdding ? 'Zrušit' : 'Přidat nabídku'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Pozice</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Např. Stáž v agro-technologické firmě"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Společnost</label>
              <input 
                type="text" 
                value={formData.company}
                onChange={e => setFormData({...formData, company: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="Název firmy"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Popis</label>
              <Editor 
                value={formData.description}
                onChange={val => setFormData({...formData, description: val})}
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Externí odkaz (přihláška)</label>
              <input 
                type="text" 
                value={formData.link}
                onChange={e => setFormData({...formData, link: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder="https://jobs.cz/..."
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Aktivní do (automatická deaktivace)</label>
              <input 
                type="date" 
                value={formData.expires_at}
                onChange={e => setFormData({...formData, expires_at: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => addMutation.mutate({...formData, expires_at: formData.expires_at || null})}
                disabled={!formData.title || !formData.company}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
              >
                <Save size={18} /> Uložit nabídku
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {jobs.map((job: any) => (
          <div key={job.id} className={`bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl ${(!job.is_active || (job.expires_at && new Date(job.expires_at) < new Date())) ? 'opacity-60' : 'hover:border-green-100'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-grow">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-bold text-stone-900">{job.title}</h3>
                  {(!job.is_active || (job.expires_at && new Date(job.expires_at) < new Date())) && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                      {job.expires_at && new Date(job.expires_at) < new Date() ? 'Expirováno' : 'Neaktivní'}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-stone-400 text-sm font-medium">
                  <span className="flex items-center gap-1.5"><Building2 size={14} /> {job.company}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-300">Přidáno: {new Date(job.created_at).toLocaleDateString()}</span>
                  {job.expires_at && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">Expirace: {new Date(job.expires_at).toLocaleDateString()}</span>
                  )}
                </div>
                <p className="mt-2 text-stone-500 text-sm line-clamp-1">{stripHtmlToText(richTextToClientHtml(String(job.description || '')))}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => toggleMutation.mutate({ id: job.id, status: !job.is_active })}
                  className={`p-4 rounded-2xl transition shadow-sm ${job.is_active ? 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'}`}
                  title={job.is_active ? 'Deaktivovat' : 'Aktivovat'}
                >
                  {job.is_active ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
                </button>
                <a 
                  href={job.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-4 bg-stone-50 text-stone-600 rounded-2xl hover:bg-stone-900 hover:text-white transition shadow-sm"
                >
                  <ExternalLink size={20} />
                </a>
                <button 
                  onClick={() => deleteItem(job.id)}
                  className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition shadow-sm"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
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
