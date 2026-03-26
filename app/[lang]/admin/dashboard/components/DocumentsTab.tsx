'use client';

import React, { useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2, Download, Eye, EyeOff, Loader2, Save, X, Lock, Unlock, Globe, Upload, AlertTriangle, CheckCircle, Edit3 } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';

export default function DocumentsTab({ dict, uploadFile }: { dict: any, uploadFile?: (file: File, bucket: string) => Promise<string> }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [q, setQ] = useState('');
  const [formData, setFormData] = useState({ title: '', title_en: '', file_url: '', category: 'Ostatní', access_level: 'member', is_member_only: true, share_enabled: false, share_token: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEdit = (doc: any) => {
    setEditingItem(doc);
    const accessLevel = doc.access_level ? String(doc.access_level) : doc.is_member_only ? 'member' : 'public';
    setFormData({
      title: doc.title || '',
      title_en: doc.title_en || '',
      file_url: doc.file_url || '',
      category: doc.category || 'Ostatní',
      access_level: accessLevel,
      is_member_only: accessLevel !== 'public',
      share_enabled: !!doc.share_enabled,
      share_token: doc.share_token || ''
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingItem(null);
    setFormData({ title: '', title_en: '', file_url: '', category: 'Ostatní', access_level: 'member', is_member_only: true, share_enabled: false, share_token: '' });
  };

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['admin_documents'],
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const filteredDocuments = useMemo(() => {
    const query = String(q || '').trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((d: any) => {
      const hay = [
        d?.title,
        d?.title_en,
        d?.category,
        d?.access_level,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return hay.includes(query);
    });
  }, [documents, q]);

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      const payload = { ...newData, is_member_only: newData.access_level !== 'public' };
      if (editingItem) {
        const { error } = await supabase.from('documents').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('documents').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_documents'] });
      showToast(editingItem ? 'Dokument upraven' : 'Dokument přidán', 'success');
      handleCancel();
    },
    onError: (err: any) => {
      showToast(err.message, 'error');
    }
  });

  const handleFileUpload = async (file: File) => {
    if (!uploadFile) {
      showToast('Funkce pro nahrávání není k dispozici', 'error');
      return;
    }
    
    setIsUploading(true);
    try {
      const url = await uploadFile(file, 'documents');
      setFormData(prev => ({ ...prev, file_url: url, title: prev.title || file.name }));
      showToast('Soubor nahrán', 'success');
    } catch (error: any) {
      showToast(error.message || 'Chyba při nahrávání', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_documents'] });
      showToast('Dokument smazán', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat dokument?',
      message: 'Opravdu chcete tento dokument smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const setShare = async (doc: any, enabled: boolean) => {
    try {
      const token = enabled
        ? (doc.share_token ||
            Array.from(crypto.getRandomValues(new Uint8Array(16)))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join(''))
        : null;
      const { error } = await supabase
        .from('documents')
        .update({ share_enabled: enabled, share_token: token })
        .eq('id', doc.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['admin_documents'] });
      showToast(enabled ? 'Sdílení zapnuto' : 'Sdílení vypnuto', 'success');
      if (enabled && token) {
        const url = `${window.location.origin}/api/documents/share/${token}`;
        try {
          await navigator.clipboard.writeText(url);
          showToast('Link zkopírován', 'success');
        } catch {}
      }
    } catch (e: any) {
      showToast(e?.message || 'Chyba', 'error');
    }
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <AdminModuleHeader
        title={dict.admin.tabDocuments}
        description="Správa interních i veřejných dokumentů"
        actions={
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
              {isAdding ? dict.admin.btnCancel : dict.admin.addDocument}
            </button>
          </div>
        }
      />

      {!isAdding && documents.length === 0 ? (
        <AdminEmptyState
          icon={FileText}
          title={dict.admin.emptyDocuments || 'Žádné dokumenty'}
          description="Přidej první dokument a vyber, zda je jen pro členy."
          action={
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="bg-green-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
            >
              <Plus size={16} /> {dict.admin.addDocument}
            </button>
          }
        />
      ) : null}

      {isAdding && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Nahrát soubor (Drag & Drop)</label>
              <div 
                onDragEnter={onDrag}
                onDragLeave={onDrag}
                onDragOver={onDrag}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-2 border-2 border-dashed rounded-[2rem] p-12 text-center transition cursor-pointer group ${dragActive ? 'border-green-500 bg-green-50' : 'border-stone-200 hover:border-green-400 hover:bg-stone-50'}`}
              >
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} />
                <div className="flex flex-col items-center gap-4">
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition ${formData.file_url ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-400 group-hover:scale-110'}`}>
                    {isUploading ? <Loader2 className="animate-spin" size={32} /> : formData.file_url ? <CheckCircle size={32} /> : <Upload size={32} />}
                  </div>
                  <div>
                    <p className="font-bold text-stone-700">{formData.file_url ? 'Soubor připraven' : 'Klikněte nebo přetáhněte soubor'}</p>
                    <p className="text-xs text-stone-400 mt-1">PDF, DOCX, XLSX (max 10MB)</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.documentTitle} (CZ)</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="Např. Stanovy spolku"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.documentTitle} (EN)</label>
                <input 
                  type="text" 
                  value={formData.title_en}
                  onChange={e => setFormData({...formData, title_en: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="e.g. Association Statutes"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kategorie</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition appearance-none"
              >
                <option value="Interní">Interní (Stanovy, Manuály)</option>
                <option value="Veřejné">Veřejné dokumenty</option>
                <option value="Ostatní">Ostatní</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Přístup</label>
              <select
                value={formData.access_level}
                onChange={(e) => setFormData({ ...formData, access_level: e.target.value })}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition appearance-none"
              >
                <option value="public">Veřejné</option>
                <option value="member">Jen členové</option>
                <option value="admin">Jen admin</option>
              </select>
            </div>
          </div>

          <button 
            onClick={() => saveMutation.mutate(formData)}
            disabled={!formData.title || !formData.file_url || saveMutation.isPending}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {editingItem ? dict.admin.btnUpdateDocument : dict.admin.btnSaveDocument}
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {documents.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Žádné dokumenty k zobrazení</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border border-dashed border-stone-200 text-center">
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Žádné výsledky</p>
          </div>
        ) : (
          filteredDocuments.map((doc: any) => (
            <div key={doc.id} className="bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl hover:border-green-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    {String(doc.access_level || (doc.is_member_only ? 'member' : 'public')) === 'admin' ? (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md"><Lock size={10} /> Jen admin</span>
                    ) : doc.is_member_only ? (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md"><Lock size={10} /> Jen členové</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 rounded-md"><Globe size={10} /> Veřejné</span>
                    )}
                    {doc.share_enabled && doc.share_token ? (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md"><Eye size={10} /> Sdílení</span>
                    ) : null}
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 mb-1">{doc.title}</h3>
                  <div className="flex items-center gap-4 text-stone-400 text-[10px] font-black uppercase tracking-widest">
                    <span className="bg-stone-50 px-2 py-0.5 rounded-md">{doc.category}</span>
                    <span>Nahrané: {new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShare(doc, !doc.share_enabled)}
                    className="p-4 bg-stone-50 text-stone-600 rounded-2xl hover:bg-stone-900 hover:text-white transition shadow-sm"
                  >
                    {doc.share_enabled ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                  <button 
                    onClick={() => handleEdit(doc)}
                    className="p-4 bg-stone-50 text-stone-600 rounded-2xl hover:bg-stone-900 hover:text-white transition shadow-sm"
                  >
                    <Edit3 size={20} />
                  </button>
                  <a 
                    href={doc.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-4 bg-stone-50 text-stone-600 rounded-2xl hover:bg-stone-900 hover:text-white transition shadow-sm"
                  >
                    <Download size={20} />
                  </a>
                  <button 
                    onClick={() => deleteItem(doc.id)}
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
