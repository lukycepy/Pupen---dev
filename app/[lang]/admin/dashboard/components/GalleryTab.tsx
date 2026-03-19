'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Image as ImageIcon, Loader2, Tag, X, Search, Folder, Link as LinkIcon } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import CopyButton from '@/app/components/CopyButton';

type MediaMeta = { tags: string[]; folder: string };
const META_KEY = 'pupen_media_meta_v1';

function readMeta(): Record<string, MediaMeta> {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMeta(meta: Record<string, MediaMeta>) {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {}
}

export default function GalleryTab({
  dict,
  uploadImage,
  currentUser,
  readOnly = false,
  events = [],
  posts = [],
}: {
  dict: any;
  uploadImage: any;
  currentUser?: any;
  readOnly?: boolean;
  events?: any[];
  posts?: any[];
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({ title: '', title_en: '', category: 'Akce', event_date: '' });
  const [activeFilter, setActiveFilter] = useState('Vše');
  const [folderFilter, setFolderFilter] = useState('Vše');
  const [query, setQuery] = useState('');
  const [meta, setMeta] = useState<Record<string, MediaMeta>>({});
  const [editOpen, setEditOpen] = useState<null | { id: string; url: string }>(null);
  const [editFolder, setEditFolder] = useState('');
  const [editTags, setEditTags] = useState('');
  const [usageOpen, setUsageOpen] = useState<null | { title: string; items: Array<{ type: string; id: string; title: string }> }>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    setMeta(readMeta());
  }, []);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['admin_gallery'],
    queryFn: async () => {
      const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const folders = useMemo(() => {
    const set = new Set<string>();
    Object.values(meta || {}).forEach((m) => {
      if (m?.folder) set.add(m.folder);
    });
    return ['Vše', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [meta]);

  const usageByUrl = useMemo(() => {
    const map = new Map<string, Array<{ type: string; id: string; title: string }>>();
    const add = (url: string, item: { type: string; id: string; title: string }) => {
      if (!url) return;
      const arr = map.get(url) || [];
      arr.push(item);
      map.set(url, arr);
    };

    const evs = Array.isArray(events) ? events : [];
    const ps = Array.isArray(posts) ? posts : [];

    const scan = (url: string, type: string, obj: any, title: string) => {
      if (!url) return false;
      try {
        return JSON.stringify(obj).includes(url);
      } catch {
        return false;
      }
    };

    for (const img of images || []) {
      const url = img.image_url;
      if (!url) continue;
      for (const e of evs) {
        const title = e.title || 'Akce';
        if (scan(url, 'event', e, title)) add(url, { type: 'Akce', id: String(e.id), title });
      }
      for (const p of ps) {
        const title = p.title || 'Novinka';
        if (scan(url, 'post', p, title)) add(url, { type: 'Novinka', id: String(p.id), title });
      }
    }
    return map;
  }, [events, images, posts]);

  const filteredImages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (images || []).filter((img: any) => {
      if (activeFilter !== 'Vše' && img.category !== activeFilter) return false;
      const m = meta[String(img.id)] || { tags: [], folder: '' };
      if (folderFilter !== 'Vše' && (m.folder || '') !== folderFilter) return false;
      if (!q) return true;
      const hay = `${img.title || ''} ${(img.title_en || '')} ${(m.folder || '')} ${(m.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeFilter, folderFilter, images, meta, query]);

  const openEdit = (img: any) => {
    const m = meta[String(img.id)] || { tags: [], folder: '' };
    setEditFolder(m.folder || '');
    setEditTags((m.tags || []).join(', '));
    setEditOpen({ id: String(img.id), url: img.image_url });
  };

  const saveEdit = () => {
    if (!editOpen) return;
    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    const next = {
      ...meta,
      [editOpen.id]: { tags, folder: editFolder.trim() },
    };
    setMeta(next);
    writeMeta(next);
    setEditOpen(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (files.length === 0) throw new Error(dict.admin.clickUpload || 'Vyberte soubory');
      
      // Postupné nahrávání s indikací pokroku by bylo lepší, ale pro začátek stačí hromadné
      for (const f of files) {
        const imageUrl = await uploadImage(f, 'gallery');
        const { error } = await supabase.from('gallery').insert([{ 
          ...formData, 
          title: files.length > 1 ? `${formData.title} - ${f.name.split('.')[0]}` : formData.title,
          image_url: imageUrl 
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_gallery'] });
      setIsAdding(false);
      setFiles([]);
      setFormData({ title: '', title_en: '', category: 'Akce', event_date: '' });
      showToast(dict.admin.gallery?.saveSuccess || 'Fotografie byly úspěšně nahrány', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gallery').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_gallery'] });
      showToast(dict.admin.confirmDeleteSuccess, 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat fotografii?',
      message: 'Opravdu chcete tuto fotografii smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-3 mb-1">
            <ImageIcon className="text-green-600" />
            {dict.admin.tabGallery}
          </h2>
          <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Správa fotek a alb z akcí</p>
        </div>
        {!readOnly && (
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-green-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-500 transition shadow-lg shadow-green-900/20 flex items-center gap-2"
          >
            {isAdding ? <X size={16} /> : <Plus size={16} />}
            {isAdding ? 'Zrušit' : dict.admin.gallery.addPhoto}
          </button>
        )}
      </div>

      {isAdding && !readOnly && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelTitle}</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="Název fotky"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelTitleEn}</label>
                <input 
                  type="text" 
                  value={formData.title_en}
                  onChange={e => setFormData({...formData, title_en: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="Photo title (EN)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Datum akce</label>
                  <input 
                    type="date" 
                    value={formData.event_date}
                    onChange={e => setFormData({...formData, event_date: e.target.value})}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kategorie</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  >
                    <option>{dict.admin.gallery.categories.events}</option>
                    <option>{dict.admin.gallery.categories.lectures}</option>
                    <option>{dict.admin.gallery.categories.other}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Nahrát fotografie (možno i více najednou)</label>
              <div 
                onClick={() => document.getElementById('file-upload')?.click()}
                className={`flex-grow border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer transition-all duration-300 ${files.length > 0 ? 'border-green-500 bg-green-50' : 'border-stone-200 bg-stone-50 hover:border-green-300'}`}
              >
                <input 
                  id="file-upload"
                  type="file" 
                  accept="image/*"
                  multiple
                  onChange={e => setFiles(Array.from(e.target.files || []))}
                  className="hidden" 
                />
                {files.length > 0 ? (
                  <div className="text-center">
                    <ImageIcon className="text-green-600 mx-auto mb-2" size={32} />
                    <p className="text-xs font-bold text-green-700 truncate max-w-[200px]">
                      {files.length === 1 ? files[0].name : `${files.length} souborů vybráno`}
                    </p>
                    <p className="text-[10px] text-green-600/60 uppercase font-black tracking-widest mt-1">Připraveno k nahrání</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Plus className="text-stone-300 mx-auto mb-2" size={32} />
                    <p className="text-xs font-bold text-stone-400">{dict.admin.clickUpload}</p>
                  </div>
                )}
              </div>
              <button 
                onClick={() => saveMutation.mutate()} 
                disabled={saveMutation.isPending || files.length === 0} 
                className="w-full bg-stone-900 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-600 disabled:opacity-50 transition shadow-lg"
              >
                {saveMutation.isPending ? <Loader2 className="animate-spin mx-auto" /> : dict.admin.gallery.uploadBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILTRY */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
        {['Vše', dict.admin.gallery.categories.events, dict.admin.gallery.categories.lectures, dict.admin.gallery.categories.other].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === cat ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-stone-400 border hover:bg-stone-50'}`}
          >
            {cat}
          </button>
        ))}
      </div>
        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-7 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat podle názvu, tagu nebo složky…"
              className="w-full bg-white border border-stone-200 rounded-2xl pl-12 pr-4 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
            />
          </div>
          <div className="md:col-span-5 flex items-center gap-2 bg-white border border-stone-200 rounded-2xl px-4 py-3">
            <Folder size={18} className="text-stone-300" />
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="w-full bg-transparent font-bold text-sm text-stone-700 outline-none"
            >
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {filteredImages.map((img: any) => (
          <div key={img.id} className="relative aspect-square rounded-3xl overflow-hidden group border border-stone-100 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
            <Image src={img.image_url} alt={img.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
            
            {/* OVERLAY */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
              <p className="text-white font-bold text-xs mb-1 truncate">{img.title}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[8px] font-black uppercase tracking-widest text-white/60 bg-white/10 px-2 py-0.5 rounded backdrop-blur-md">
                  {img.category}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const usages = usageByUrl.get(img.image_url) || [];
                      setUsageOpen({
                        title: img.title || 'Médium',
                        items: usages,
                      });
                    }}
                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition backdrop-blur-md"
                    title="Použití"
                  >
                    <LinkIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(img)}
                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition backdrop-blur-md"
                    title="Tagy / složka"
                  >
                    <Tag size={14} />
                  </button>
                  {!readOnly && (
                    <button 
                      onClick={() => deleteItem(img.id)} 
                      className="p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition backdrop-blur-md"
                      title="Smazat"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {(() => {
                const m = meta[String(img.id)];
                const folder = m?.folder || '';
                const tags = (m?.tags || []).slice(0, 3);
                const usage = (usageByUrl.get(img.image_url) || []).length;
                return (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {folder && (
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/70 bg-white/10 px-2 py-0.5 rounded backdrop-blur-md">
                        {folder}
                      </span>
                    )}
                    {tags.map((t) => (
                      <span key={t} className="text-[8px] font-black uppercase tracking-widest text-white/70 bg-white/10 px-2 py-0.5 rounded backdrop-blur-md">
                        {t}
                      </span>
                    ))}
                    {usage > 0 && (
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/70 bg-green-600/50 px-2 py-0.5 rounded backdrop-blur-md">
                        used {usage}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditOpen(null)}
            aria-label="Zavřít"
          />
          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Médium</div>
                <div className="font-black text-stone-900">Tagy a složka</div>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(null)}
                className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400"
                aria-label="Zavřít"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-stone-700 truncate">{editOpen.url}</div>
                  <CopyButton value={editOpen.url} className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Složka</label>
                  <input
                    value={editFolder}
                    onChange={(e) => setEditFolder(e.target.value)}
                    placeholder="např. Akce 2026"
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Tagy</label>
                  <input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="např. party, uvodak, promo"
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(null)}
                  className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-200 transition"
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="flex-1 bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-green-500 transition shadow-lg shadow-green-900/20"
                >
                  Uložit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {usageOpen && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setUsageOpen(null)}
            aria-label="Zavřít"
          />
          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] border border-stone-100 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Použití</div>
                <div className="font-black text-stone-900 truncate">{usageOpen.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setUsageOpen(null)}
                className="p-2 rounded-xl hover:bg-stone-50 transition text-stone-400"
                aria-label="Zavřít"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-8">
              {usageOpen.items.length === 0 ? (
                <div className="py-10 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                  Nikde nenalezeno.
                </div>
              ) : (
                <div className="space-y-2">
                  {usageOpen.items.slice(0, 40).map((u, idx) => (
                    <div key={`${u.type}-${u.id}-${idx}`} className="p-4 bg-stone-50 border border-stone-100 rounded-2xl">
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{u.type}</div>
                      <div className="font-bold text-stone-900">{u.title}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-300">#{u.id}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
