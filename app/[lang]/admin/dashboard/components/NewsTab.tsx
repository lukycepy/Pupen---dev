'use client';

import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit3, Image as ImageIcon, FileText, Users, Loader2, Save, X } from 'lucide-react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useToast } from '../../../../context/ToastContext';
import { logAdminAction } from '@/lib/admin-logger';
import AdminModuleHeader from './ui/AdminModuleHeader';
import ConfirmModal from '@/app/components/ConfirmModal';
import { seoSuggestions, suggestEnglishText } from '@/lib/ai/pilot';

const Editor = dynamic(() => import('../../../components/Editor'), { 
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-stone-50 animate-pulse rounded-xl border border-dashed border-stone-200" />
});

interface NewsTabProps {
  dict: any;
  uploadImage: (file: File, bucket: string, pathPrefix?: string) => Promise<string>;
  currentUser?: any;
  userProfile?: any;
  readOnly?: boolean;
}

const PAGE_SIZE = 30;

export default function NewsTab({ dict, uploadImage, currentUser, userProfile, readOnly = false }: NewsTabProps) {
  const newsSchema = z.object({
    title: z.string().min(3, dict.admin.validation.min3),
    title_en: z.string().optional(),
    category: z.string(),
    excerpt: z.string().min(10, dict.admin.validation.min10),
    excerpt_en: z.string().optional(),
    content: z.string().min(20, dict.admin.validation.min20),
    content_en: z.string().optional(),
    published_at: z.string().optional(),
  });

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [editingPost, setEditingPost] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const postsQuery = useInfiniteQuery({
    queryKey: ['posts_paged'],
    queryFn: async ({ pageParam }) => {
      const from = typeof pageParam === 'number' ? pageParam : 0;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase.from('posts').select('*').order('created_at', { ascending: false }).range(from, to);
      if (res.error) throw res.error;
      const items = res.data || [];
      return { items, nextFrom: items.length === PAGE_SIZE ? to + 1 : null };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextFrom,
  });

  const posts = (postsQuery.data?.pages || []).flatMap((p) => p.items);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<any>({
    resolver: zodResolver(newsSchema),
    defaultValues: {
      category: 'Zprávy',
      content: '',
      content_en: '',
      title: '',
      title_en: '',
      excerpt: '',
      excerpt_en: '',
      published_at: ''
    }
  });

  const excerpt = watch('excerpt');
  const excerptEn = watch('excerpt_en');
  const content = watch('content');
  const contentEn = watch('content_en');
  const title = watch('title');
  const titleEn = watch('title_en');

  const seo = seoSuggestions({
    title: title || '',
    descriptionHtml: excerpt || '',
    imageUrl: imageFile ? 'local' : editingPost?.image_url,
    canonicalPath: editingPost?.id ? `/cs/novinky/${editingPost.id}` : undefined,
  });

  // Mutation for Save/Update
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      let imageUrl = editingPost?.image_url || null;
      if (imageFile) {
        if (imageFile.size > 5 * 1024 * 1024) { // 5MB limit
          throw new Error('Obrázek je příliš velký (max 5MB).');
        }
        try {
          imageUrl = await uploadImage(imageFile, 'blog');
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr);
          throw new Error('Nepodařilo se nahrát obrázek. Zkuste jiný soubor nebo zkontrolujte připojení.');
        }
      }
      
      const payload = { 
        title: data.title,
        title_en: data.title_en || null,
        category: data.category,
        excerpt: data.excerpt,
        excerpt_en: data.excerpt_en || null,
        content: data.content,
        content_en: data.content_en || null,
        image_url: imageUrl,
        published_at: data.published_at && data.published_at !== "" ? new Date(data.published_at).toISOString() : null
      };

      if (editingPost?.id) {
        // Save current version for Audit Log 2.0
        try {
          const { data: currentPost } = await supabase.from('posts').select('*').eq('id', editingPost.id).single();
          if (currentPost) {
            await supabase.from('content_versions').insert([{
              table_name: 'posts',
              record_id: editingPost.id,
              version_data: currentPost,
              created_by: currentUser?.id
            }]);
          }
        } catch (vErr) {
          console.error('Failed to save version:', vErr);
        }

        const { error } = await supabase.from('posts').update(payload).eq('id', editingPost.id);
        if (error) throw error;
        
        try {
          await logAdminAction(currentUser?.email, `Upravil novinku: ${data.title}`, editingPost.id, payload, userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined);
        } catch (logErr) {
          console.error('Failed to log admin action:', logErr);
        }
      } else {
        const { data: newPost, error } = await supabase.from('posts').insert([payload]).select().single();
        if (error) throw error;
        
        try {
          await logAdminAction(currentUser?.email, `Vytvořil novinku: ${data.title}`, newPost.id, payload, userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : undefined);
        } catch (logErr) {
          console.error('Failed to log admin action:', logErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts_paged'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      handleCancel();
      showToast(dict.admin.alertPostSuccess, 'success');
    },
    onError: (err: any) => {
      showToast(err.message, 'error');
    }
  });

  // Mutation for Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts_paged'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      showToast(dict.admin.confirmDeleteSuccess || 'Smazáno', 'success');
    },
    onError: (err: any) => {
      showToast(err.message, 'error');
    }
  });

  const onSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  const handleEdit = (post: any) => {
    setEditingPost(post);
    reset({
      title: post.title,
      title_en: post.title_en || '',
      category: post.category,
      excerpt: post.excerpt || '',
      excerpt_en: post.excerpt_en || '',
      content: post.content || '',
      content_en: post.content_en || '',
      published_at: post.published_at ? new Date(post.published_at).toISOString().split('T')[0] : '',
    });
  };

  const handleCancel = () => {
    setEditingPost(null);
    setImageFile(null);
    reset();
  };

  const deleteItem = (id: string) => {
    setModalConfig({
      title: dict.admin.confirmDeletePostTitle || 'Smazat článek?',
      message: dict.admin.confirmDeletePost || 'Opravdu chcete tento článek trvale smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  const filteredPosts = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => String(p.title || '').toLowerCase().includes(q) || String(p.category || '').toLowerCase().includes(q));
  }, [localSearch, posts]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={dict.admin.tabNews}
        description="Publikování článků a aktualit na webu"
        actions={
          !readOnly && !editingPost ? (
            <button 
              onClick={() => setEditingPost({ id: null })} 
              className="bg-green-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
            >
              <Plus size={16} /> {dict.admin.newPost}
            </button>
          ) : null
        }
      />

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* FORM SECTION */}
        {editingPost && (
          <div className="lg:col-span-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 animate-in slide-in-from-left duration-500">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-stone-900 flex items-center gap-3">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  {editingPost?.id ? <Edit3 size={20} /> : <Plus size={20} />} 
                </div>
                {editingPost?.id ? dict.admin.editPost : dict.admin.newPost}
              </h2>
              <button onClick={handleCancel} className="p-2 hover:bg-stone-50 rounded-full transition text-stone-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelTitle} (CZ)</label>
                  <input {...register('title')} type="text" placeholder="Nadpis novinky..." className={`w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition ${errors.title ? 'ring-red-500 focus:ring-red-500' : ''}`} />
                  {errors.title && <p className="text-red-500 text-[10px] font-bold px-1">{errors.title.message as string}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelTitleEn || 'News Title'} (EN)</label>
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        if ((titleEn || '').trim()) return;
                        setValue('title_en', suggestEnglishText(title || ''));
                      }}
                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                    >
                      Title EN
                    </button>
                  </div>
                  <input {...register('title_en')} type="text" placeholder="News title..." className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Kategorie</label>
                    <select {...register('category')} className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition appearance-none">
                      <option value="Zprávy">{dict.categories['Zprávy']}</option>
                      <option value="Reportáž">{dict.categories['Reportáž']}</option>
                      <option value="Oznámení">{dict.categories['Oznámení']}</option>
                      <option value="Ostatní">{dict.categories['Ostatní']}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelPublishedAt}</label>
                    <input {...register('published_at')} type="date" className="w-full border-none p-4 rounded-2xl outline-none ring-1 ring-stone-100 focus:ring-2 focus:ring-green-500 bg-stone-50/50 font-bold text-stone-700 transition" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelExcerpt} (CZ)</label>
                  <Editor value={excerpt} onChange={(val) => setValue('excerpt', val)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelExcerptEn || 'Perex (EN)'}</label>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if ((excerptEn || '').trim()) return;
                        setValue('excerpt_en', `<p>${suggestEnglishText(excerpt || '')}</p>`);
                      }}
                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                    >
                      Návrh EN
                    </button>
                  </div>
                  <Editor value={excerptEn || ''} onChange={(val) => setValue('excerpt_en', val)} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelContent} (CZ)</label>
                  <Editor value={content} onChange={(val) => setValue('content', val)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelContentEn || 'Obsah (EN)'}</label>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if ((contentEn || '').trim()) return;
                        setValue('content_en', `<p>${suggestEnglishText(content || '')}</p>`);
                      }}
                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                    >
                      Návrh EN
                    </button>
                  </div>
                  <Editor value={contentEn || ''} onChange={(val) => setValue('content_en', val)} />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Obrázek článku</label>
                <div className="border-2 border-dashed border-stone-200 rounded-[2rem] p-8 text-center cursor-pointer relative group hover:border-green-400 hover:bg-green-50/30 transition-all duration-300">
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="flex flex-col items-center text-stone-400 group-hover:text-green-600 transition-colors">
                      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white group-hover:shadow-md transition-all">
                        <ImageIcon size={32} />
                      </div>
                      {imageFile ? (
                        <span className="font-bold text-sm text-green-600 break-all">{imageFile.name}</span>
                      ) : (
                        <>
                          <span className="text-sm font-bold text-stone-600 mb-1">{dict.admin.clickUpload}</span>
                          <span className="text-[10px] font-medium">PNG, JPG nebo WEBP (max. 5MB)</span>
                        </>
                      )}
                    </div>
                </div>
              </div>

              {seo.length > 0 && (
                <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">SEO návrhy</div>
                  <div className="space-y-2">
                    {seo.map((s) => (
                      <div key={s} className="text-sm font-bold text-stone-700">
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-200 transition-all"
                >
                  {dict.admin.btnCancel}
                </button>
                <button 
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  {editingPost?.id ? dict.admin.btnUpdatePost : dict.admin.btnSavePost}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LIST SECTION */}
        <div className={`${editingPost ? 'lg:col-span-6' : 'lg:col-span-12'} bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden transition-all duration-500`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h2 className="text-xl font-black text-stone-900">{dict.admin.listPosts}</h2>
            <div className="flex items-center gap-4">
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Hledat v novinkách..." 
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold text-stone-700 outline-none focus:ring-2 focus:ring-green-500 transition-all w-full md:w-64"
                />
              </div>
              {readOnly && <span className="px-3 py-1 bg-stone-50 text-stone-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-stone-100">{dict.admin.readOnly}</span>}
            </div>
          </div>
          
          <div className="space-y-4">
            {filteredPosts.map(p => (
              <div key={p.id} className="flex flex-col sm:flex-row gap-4 sm:items-center p-5 bg-stone-50/50 rounded-[2rem] border border-transparent hover:border-stone-100 hover:bg-white transition-all group">
                <div className="w-20 h-20 relative rounded-2xl overflow-hidden shrink-0 shadow-sm">
                  {p.image_url ? (
                    <Image src={p.image_url} alt="" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-300">
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-stone-900 text-lg truncate">{p.title}</h3>
                    <span className="px-2 py-0.5 bg-stone-200 text-stone-600 rounded text-[8px] font-black uppercase tracking-tighter">
                      {dict.categories[p.category] || p.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-stone-400 font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><FileText size={12} /> {new Date(p.created_at).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1.5"><Users size={12} /> {p.views || 0} zobrazení</span>
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(p)} className="p-2.5 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"><Edit3 size={20} /></button>
                    <button onClick={() => deleteItem(p.id)} className="p-2.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20} /></button>
                  </div>
                )}
              </div>
            ))}

            {postsQuery.hasNextPage && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => postsQuery.fetchNextPage()}
                  disabled={postsQuery.isFetchingNextPage}
                  className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  {postsQuery.isFetchingNextPage ? (dict.admin.btnLoading || 'Načítám...') : (dict.admin.btnMore || 'Načíst další')}
                </button>
              </div>
            )}
          </div>
        </div>
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
