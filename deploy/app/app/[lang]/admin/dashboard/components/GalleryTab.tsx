'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Folder, Plus, Trash2, Image as ImageIcon, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';

export default function GalleryTab(props: any) {
  const { uploadImage } = props;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [isAddingAlbum, setIsAddingAlbum] = useState(false);
  const [newAlbum, setNewAlbum] = useState({ title: '', description: '', year: new Date().getFullYear(), is_public: true });
  
  const [isUploading, setIsUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', onConfirm: () => {} });

  const { data: albums = [], isLoading: loadingAlbums } = useQuery({
    queryKey: ['gallery_albums'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gallery_albums').select('*').order('year', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: photos = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ['gallery_photos', activeAlbumId],
    queryFn: async () => {
      if (!activeAlbumId) return [];
      const { data, error } = await supabase.from('gallery_photos').select('*').eq('album_id', activeAlbumId).order('sort_order', { ascending: true }).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeAlbumId
  });

  const createAlbumMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('gallery_albums').insert([newAlbum]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery_albums'] });
      setIsAddingAlbum(false);
      setNewAlbum({ title: '', description: '', year: new Date().getFullYear(), is_public: true });
      showToast('Album vytvořeno', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteAlbumMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gallery_albums').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery_albums'] });
      showToast('Album smazáno', 'success');
      setActiveAlbumId(null);
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const toggleAlbumPublicMutation = useMutation({
    mutationFn: async ({ id, is_public }: { id: string, is_public: boolean }) => {
      const { error } = await supabase.from('gallery_albums').update({ is_public }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery_albums'] });
    }
  });

  const uploadPhotosMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!activeAlbumId) throw new Error('Není vybráno album');
      setIsUploading(true);
      
      const uploadedUrls: string[] = [];
      for (const file of files) {
        try {
          const url = await uploadImage(file, 'gallery');
          uploadedUrls.push(url);
        } catch (err) {
          console.error('Chyba nahrávání:', err);
        }
      }

      if (uploadedUrls.length > 0) {
        const inserts = uploadedUrls.map(url => ({
          album_id: activeAlbumId,
          image_url: url
        }));
        const { error } = await supabase.from('gallery_photos').insert(inserts);
        if (error) throw error;

        const album = albums.find(a => a.id === activeAlbumId);
        if (album && !album.cover_image_url) {
           await supabase.from('gallery_albums').update({ cover_image_url: uploadedUrls[0] }).eq('id', activeAlbumId);
           queryClient.invalidateQueries({ queryKey: ['gallery_albums'] });
        }
      }
      setIsUploading(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery_photos', activeAlbumId] });
      showToast('Fotografie nahrány', 'success');
    },
    onError: (err: any) => {
      setIsUploading(false);
      showToast(err.message, 'error');
    }
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gallery_photos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery_photos', activeAlbumId] });
      showToast('Fotografie smazána', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const handleDeleteAlbum = (id: string) => {
    setModalConfig({
      title: 'Smazat album',
      message: 'Opravdu chcete smazat toto album? Všechny fotky v něm budou také smazány.',
      onConfirm: () => deleteAlbumMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const handleDeletePhoto = (id: string) => {
    setModalConfig({
      title: 'Smazat fotku',
      message: 'Opravdu chcete smazat tuto fotku?',
      onConfirm: () => deletePhotoMutation.mutate(id)
    });
    setModalOpen(true);
  };

  if (activeAlbumId) {
    const album = albums.find(a => a.id === activeAlbumId);
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveAlbumId(null)}
            className="p-3 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition text-stone-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-stone-900">{album?.title}</h2>
            <p className="text-sm text-stone-500">{album?.year} • {album?.description}</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border shadow-sm flex flex-col items-center justify-center border-dashed border-2 border-stone-200">
          <input 
            type="file" 
            multiple 
            accept="image/*"
            id="photo-upload"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                uploadPhotosMutation.mutate(Array.from(e.target.files));
              }
            }}
          />
          <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center">
            <div className={`p-4 rounded-full ${isUploading ? 'bg-green-100 text-green-600 animate-pulse' : 'bg-stone-100 text-stone-500'} mb-4`}>
              {isUploading ? <Loader2 size={32} className="animate-spin" /> : <ImageIcon size={32} />}
            </div>
            <span className="font-bold text-stone-700">{isUploading ? 'Nahrávám...' : 'Klikněte pro nahrání fotek'}</span>
            <span className="text-xs text-stone-400 mt-1">Lze vybrat více souborů najednou</span>
          </label>
        </div>

        {loadingPhotos ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-stone-300" size={32} /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {photos.map((photo: any) => (
              <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden group bg-stone-100">
                <Image src={photo.image_url} alt="Photo" fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <ConfirmModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onConfirm={modalConfig.onConfirm} title={modalConfig.title} message={modalConfig.message} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-3 mb-1">
            <ImageIcon className="text-green-600" />
            Galerie a Alba
          </h2>
          <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Správa fotoalb z akcí</p>
        </div>
        <button 
          onClick={() => setIsAddingAlbum(!isAddingAlbum)}
          className="bg-green-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-500 transition shadow-lg shadow-green-900/20 flex items-center gap-2"
        >
          <Plus size={16} />
          {isAddingAlbum ? 'Zrušit' : 'Nové album'}
        </button>
      </div>

      {isAddingAlbum && (
        <div className="bg-white p-8 rounded-3xl border shadow-xl">
          <h3 className="font-bold text-lg mb-4">Vytvořit nové album</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <input 
              type="text" 
              placeholder="Název alba" 
              value={newAlbum.title}
              onChange={e => setNewAlbum({...newAlbum, title: e.target.value})}
              className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
            />
            <input 
              type="number" 
              placeholder="Rok" 
              value={newAlbum.year}
              onChange={e => setNewAlbum({...newAlbum, year: parseInt(e.target.value)})}
              className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700"
            />
          </div>
          <textarea 
            placeholder="Popis alba (volitelné)" 
            value={newAlbum.description}
            onChange={e => setNewAlbum({...newAlbum, description: e.target.value})}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 mb-4"
          />
          <div className="flex items-center gap-4">
            <button 
              onClick={() => createAlbumMutation.mutate()}
              disabled={!newAlbum.title || createAlbumMutation.isPending}
              className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 disabled:opacity-50 transition"
            >
              Uložit album
            </button>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={newAlbum.is_public}
                onChange={e => setNewAlbum({...newAlbum, is_public: e.target.checked})}
                className="accent-green-600 w-4 h-4"
              />
              <span className="text-sm font-bold text-stone-600">Veřejné</span>
            </label>
          </div>
        </div>
      )}

      {loadingAlbums ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-stone-300" size={32} /></div>
      ) : (
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
          {albums.map((album: any) => (
            <div key={album.id} className="bg-white rounded-3xl border shadow-sm overflow-hidden group hover:shadow-lg transition">
              <div 
                className="aspect-video bg-stone-100 relative cursor-pointer"
                onClick={() => setActiveAlbumId(album.id)}
              >
                {album.cover_image_url ? (
                  <Image src={album.cover_image_url} alt={album.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-stone-300">
                    <Folder size={48} />
                  </div>
                )}
                {!album.is_public && (
                  <div className="absolute top-3 left-3 bg-stone-900/80 backdrop-blur text-white px-2 py-1 rounded-md text-[10px] font-black flex items-center gap-1">
                    <EyeOff size={12} /> Skryté
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-stone-900 leading-tight cursor-pointer hover:text-green-600 transition" onClick={() => setActiveAlbumId(album.id)}>
                    {album.title}
                  </h3>
                  <span className="text-xs font-black text-stone-400 bg-stone-100 px-2 py-1 rounded-lg">{album.year}</span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
                  <button 
                    onClick={() => toggleAlbumPublicMutation.mutate({ id: album.id, is_public: !album.is_public })}
                    className={`p-2 rounded-lg transition ${album.is_public ? 'text-green-600 hover:bg-green-50' : 'text-stone-400 hover:bg-stone-100'}`}
                    title={album.is_public ? 'Zneveřejnit' : 'Zveřejnit'}
                  >
                    {album.is_public ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button 
                    onClick={() => handleDeleteAlbum(album.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Smazat album"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onConfirm={modalConfig.onConfirm} title={modalConfig.title} message={modalConfig.message} />
    </div>
  );
}
