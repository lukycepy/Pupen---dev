'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Megaphone, Plus, Trash2, Power, Edit3, Loader2, Save, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import Dialog from '@/app/components/ui/Dialog';
import { SkeletonTabContent } from '../../../components/Skeleton';
import { richTextToClientHtml } from '@/lib/richtext-client';

const Editor = dynamic(() => import('../../../components/Editor'), { 
  ssr: false,
  loading: () => <div className="h-[100px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200" />
});

export default function BannersTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [formData, setFormData] = useState({ 
    text: '', 
    text_en: '', 
    link_url: '', 
    link_text: 'Více info', 
    link_text_en: 'More info', 
    bg_color: 'bg-green-600', 
    is_active: false 
  });

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['banners'],
    queryFn: async () => {
      const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // Clean payload for DB
      const payload: any = {
        text: data.text,
        text_en: data.text_en || null,
        link_url: data.link_url || null,
        link_text: data.link_text || 'Více info',
        link_text_en: data.link_text_en || 'More info',
        bg_color: data.bg_color,
        is_active: !!data.is_active
      };

      if (editingBanner) {
        const { error } = await supabase.from('banners').update(payload).eq('id', editingBanner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('banners').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      handleCancel();
      showToast('Banner uložen', 'success');
    },
    onError: (err: any) => {
      console.error('Banner save error:', err);
      showToast(err.message || 'Nepodařilo se uložit banner. Zkontrolujte připojení k databázi.', 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('banners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      showToast('Smazáno', 'success');
    }
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat banner?',
      message: 'Opravdu chcete tento banner trvale smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: any) => {
      // Nejprve deaktivujeme všechny ostatní, pokud aktivujeme tento
      if (active) {
        await supabase.from('banners').update({ is_active: false }).neq('id', id);
      }
      const { error } = await supabase.from('banners').update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] })
  });

  const handleEdit = (b: any) => {
    setEditingBanner(b);
    setFormOpen(true);
    setFormData({ 
      text: b.text, 
      text_en: b.text_en || '', 
      link_url: b.link_url || '', 
      link_text: b.link_text || 'Více info', 
      link_text_en: b.link_text_en || 'More info', 
      bg_color: b.bg_color, 
      is_active: b.is_active 
    });
  };

  const handleCancel = () => {
    setEditingBanner(null);
    setFormOpen(false);
    setFormData({ 
      text: '', 
      text_en: '', 
      link_url: '', 
      link_text: 'Více info', 
      link_text_en: 'More info', 
      bg_color: 'bg-green-600', 
      is_active: false 
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">{dict.admin.tabBanners || 'Bannery'}</h2>
          <p className="text-stone-400 text-xs font-medium mt-1">Správa horních informačních pruhů na webu</p>
        </div>
        <div className="flex items-center gap-3">
          {banners.some((b: any) => b.is_active) && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl border border-green-100">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-green-700">Aktivní banner</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => { handleCancel(); setFormOpen(true); }}
            className="flex items-center gap-2 rounded-xl border-2 border-black bg-white px-5 py-3 font-black uppercase tracking-widest text-[10px] text-black transition hover:border-green-600 hover:bg-green-50 hover:text-green-600 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-500"
          >
            <Plus size={16} /> {dict.admin.newBanner}
          </button>
        </div>
      </div>

      <Dialog
        open={formOpen || !!editingBanner}
        onClose={handleCancel}
        overlayClassName="fixed inset-0 z-[30000] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
        panelClassName="w-full max-w-3xl rounded-t-[2rem] border-2 border-black bg-white p-6 sm:rounded-[2.5rem] sm:p-8 dark:border-white dark:bg-black max-h-[92dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <h2 className="text-xl font-black text-black dark:text-white flex items-center gap-3">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg dark:bg-green-950 dark:text-green-400">
              {editingBanner ? <Edit3 size={20} /> : <Plus size={20} />} 
            </div>
            {editingBanner ? dict.admin.editBanner : dict.admin.newBanner}
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-2 rounded-2xl border-2 border-black bg-white px-4 py-3 font-bold text-black transition hover:border-green-600 hover:bg-green-50 hover:text-green-600 dark:border-white dark:bg-black dark:text-white dark:hover:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-500"
          >
            <X size={16} /> Zavřít
          </button>
        </div>

        <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.bannerText} (CZ)</label>
                <Editor 
                  value={formData.text}
                  onChange={(content) => setFormData({...formData, text: content})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.bannerText} (EN)</label>
                <Editor 
                  value={formData.text_en}
                  onChange={(content) => setFormData({...formData, text_en: content})}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelLink}</label>
              <input value={formData.link_url} onChange={e => setFormData({...formData, link_url: e.target.value})} placeholder="https://..." className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelLinkText} (CZ)</label>
                <input value={formData.link_text} onChange={e => setFormData({...formData, link_text: e.target.value})} className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelLinkText} (EN)</label>
                <input value={formData.link_text_en} onChange={e => setFormData({...formData, link_text_en: e.target.value})} className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Barva pozadí</label>
              <div className="grid grid-cols-5 gap-2 p-2 bg-stone-50 rounded-2xl border border-stone-100">
                {[
                  { val: 'bg-green-600', color: 'bg-green-600' },
                  { val: 'bg-amber-500', color: 'bg-amber-500' },
                  { val: 'bg-red-600', color: 'bg-red-600' },
                  { val: 'bg-blue-600', color: 'bg-blue-600' },
                  { val: 'bg-stone-900', color: 'bg-stone-900' }
                ].map(c => (
                  <button 
                    key={c.val}
                    onClick={() => setFormData({...formData, bg_color: c.val})}
                    className={`h-10 rounded-xl transition-all border-4 ${formData.bg_color === c.val ? 'border-white ring-2 ring-stone-200' : 'border-transparent opacity-60 hover:opacity-100'} ${c.color}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              {editingBanner && (
                <button 
                  onClick={handleCancel}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-200 transition-all"
                >
                  {dict.admin.btnCancel}
                </button>
              )}
              <button 
                onClick={() => saveMutation.mutate(formData)} 
                disabled={!formData.text || saveMutation.isPending} 
                className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {editingBanner ? dict.admin.btnUpdateBanner : dict.admin.btnSaveBanner}
              </button>
            </div>
        </div>
      </Dialog>

      {/* LIST SECTION */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
          <h2 className="text-xl font-black text-stone-900 mb-8">{dict.admin.listBanners || 'Seznam bannerů'}</h2>
          
          {isLoading ? (
            <SkeletonTabContent />
          ) : (
            <div className="space-y-4">
              {banners.map((b: any) => (
                <div key={b.id} className="p-6 bg-stone-50/50 rounded-[2rem] border border-transparent hover:border-stone-100 hover:bg-white transition-all group">
                  <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
                    <div className="flex items-center gap-4 shrink-0">
                      <div className={`w-3 h-3 rounded-full ${b.is_active ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-stone-200'}`} />
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${b.bg_color}`}>
                        <Megaphone size={20} />
                      </div>
                    </div>
                    
                    <div className="flex-grow min-w-0">
                      <div className="prose prose-sm font-bold text-stone-700 line-clamp-1 mb-1" dangerouslySetInnerHTML={{ __html: richTextToClientHtml(String(b.text || '')) }} />
                      <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-stone-400">
                        <span className="flex items-center gap-1.5"><Save size={10} /> {new Date(b.created_at).toLocaleDateString()}</span>
                        {b.link_url && <span className="flex items-center gap-1.5 text-blue-500"><Plus size={10} /> S odkazem</span>}
                      </div>
                    </div>

                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleMutation.mutate({ id: b.id, active: !b.is_active })} 
                        className={`p-2.5 rounded-xl transition-all ${
                          b.is_active 
                            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' 
                            : 'text-green-600 bg-green-50 hover:bg-green-100'
                        }`}
                        title={b.is_active ? 'Deaktivovat' : 'Aktivovat'}
                      >
                        <Power size={18} />
                      </button>
                      <button onClick={() => handleEdit(b)} className="p-2.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                      <button onClick={() => deleteItem(b.id)} className="p-2.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              ))}
              
              {banners.length === 0 && (
                <div className="py-20 text-center text-stone-400 bg-stone-50/50 rounded-[3rem] border border-dashed border-stone-100">
                  <Megaphone size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="font-bold text-sm uppercase tracking-widest">Žádné bannery k zobrazení</p>
                </div>
              )}
            </div>
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
