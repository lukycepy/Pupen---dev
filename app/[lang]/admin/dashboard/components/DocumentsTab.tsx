'use client';

import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2, Download, Eye, Loader2, Save, X, Lock, Unlock, Globe, Upload, AlertTriangle, CheckCircle, Edit3 } from 'lucide-react';
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
  const [formData, setFormData] = useState({ title: '', title_en: '', file_url: '', category: 'Ostatní', is_member_only: true });
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
    setFormData({
      title: doc.title || '',
      title_en: doc.title_en || '',
      file_url: doc.file_url || '',
      category: doc.category || 'Ostatní',
      is_member_only: doc.is_member_only ?? true
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingItem(null);
    setFormData({ title: '', title_en: '', file_url: '', category: 'Ostatní', is_member_only: true });
  };

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['admin_documents'],
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (newData: any) => {
      if (editingItem) {
        const { error } = await supabase.from('documents').update(newData).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('documents').insert([newData]);
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

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <AdminModuleHeader
        title={dict.admin.tabDocuments}
        description="Správa interních i veřejných dokumentů"
        actions={
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
          >
            {isAdding ? <X size={20} /> : <Plus size={20} />}
            {isAdding ? dict.admin.btnCancel : dict.admin.addDocument}
          </button>
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
              <label className="flex items-center gap-3 cursor-pointer group p-3 bg-stone-50 rounded-xl hover:bg-green-50 transition">
                <input 
                  type="checkbox" 
                  checked={formData.is_member_only}
                  onChange={e => setFormData({...formData, is_member_only: e.target.checked})}
                  className="w-5 h-5 rounded border-stone-300 text-green-600 focus:ring-green-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-stone-700 group-hover:text-green-600 transition">Pouze pro členy</span>
                  <span className="text-[9px] text-stone-400 font-medium uppercase tracking-tighter">Dokument uvidí jen přihlášení členové</span>
                </div>
              </label>
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
        ) : (
          documents.map((doc: any) => (
            <div key={doc.id} className="bg-white p-6 rounded-[2rem] border shadow-sm group transition hover:shadow-xl hover:border-green-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    {doc.is_member_only ? (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md"><Lock size={10} /> Jen členové</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 rounded-md"><Globe size={10} /> Veřejné</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 mb-1">{doc.title}</h3>
                  <div className="flex items-center gap-4 text-stone-400 text-[10px] font-black uppercase tracking-widest">
                    <span className="bg-stone-50 px-2 py-0.5 rounded-md">{doc.category}</span>
                    <span>Nahrané: {new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
