'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, User, Clock, ArrowRight, PenTool } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { SkeletonList } from '../components/Skeleton';

import { getDictionary } from '@/lib/get-dictionary';

export default function BlogPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const { showToast } = useToast();
  
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '', author_name: '', author_email: '' });
  const [dict, setDict] = useState<any>(null);

  React.useEffect(() => {
    // Try to get user email if logged in
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setFormData(prev => ({ ...prev, author_email: session.user.email || '' }));
      }
    };
    getUser();
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then(d => {
      if (isMounted) setDict(d.blog);
    });
    return () => { isMounted = false; };
  }, [lang]);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['public_blog_posts'],
    queryFn: async () => {
      const { data } = await supabase.from('student_blog').select('*').eq('is_approved', true).order('created_at', { ascending: false });
      return data || [];
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newData: any) => {
      // Find profile by email to link user_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newData.author_email)
        .maybeSingle();

      const { error } = await supabase.from('student_blog').insert([{ 
        ...newData, 
        user_id: profile?.id || null,
        is_approved: false 
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      showToast(dict?.success || (lang === 'cs' ? 'Článek odeslán ke schválení!' : 'Article sent for approval!'), 'success');
      setIsAdding(false);
      setFormData({ title: '', content: '', author_name: '', author_email: '' });
    }
  });

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-5xl mx-auto px-6">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
          <div className="max-w-2xl">
            <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
              <PenTool size={32} />
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-stone-900 tracking-tighter mb-6 leading-none">{dict.title} <span className="text-green-600">{dict.titleGreen}</span></h1>
            <p className="text-stone-500 text-xl font-medium">{dict.subtitle}</p>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-stone-900 text-white px-8 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-600 transition shadow-2xl flex items-center justify-center gap-2"
          >
            <Plus size={20} /> {dict.writeBtn}
          </button>
        </header>

        {isAdding && (
          <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl mb-20 border border-stone-100 animate-in fade-in slide-in-from-top-8 duration-500">
            <h2 className="text-2xl font-black mb-8 text-stone-900">{dict.newPost}</h2>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelTitle}</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder={dict.placeholderTitle} />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelContent}</label>
                  <textarea value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition h-[300px]" placeholder={dict.placeholderContent} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.labelAuthor}</label>
                  <input type="text" value={formData.author_name} onChange={e => setFormData({...formData, author_name: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder={dict.placeholderAuthor} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Tvůj E-mail (pro spárování s profilem)</label>
                  <input type="email" value={formData.author_email} onChange={e => setFormData({...formData, author_email: e.target.value})} className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition" placeholder="email@priklad.cz" />
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={() => addMutation.mutate(formData)}
                    disabled={!formData.title || !formData.content || !formData.author_email}
                    className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-xl shadow-green-900/20"
                  >
                    {dict.btnSubmit}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <SkeletonList />
        ) : (
          <div className="grid gap-12">
            {posts.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-stone-200 text-center">
                <p className="text-stone-400 font-bold uppercase tracking-widest">{dict.empty}</p>
              </div>
            ) : (
              posts.map((post: any) => (
                <article key={post.id} className="bg-white p-8 md:p-12 rounded-[4rem] shadow-xl border border-stone-50 group transition hover:shadow-2xl hover:border-green-100">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center gap-1.5 bg-stone-50 px-3 py-1 rounded-full">
                      <Clock size={12} /> {new Date(post.created_at).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US')}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center gap-1.5 bg-stone-50 px-3 py-1 rounded-full">
                      <User size={12} /> {post.author_name}
                    </span>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black text-stone-900 mb-8 tracking-tight group-hover:text-green-600 transition">{post.title}</h2>
                  <div className="prose prose-stone max-w-none text-stone-600 text-lg font-medium leading-relaxed line-clamp-4 mb-10">
                    {post.content}
                  </div>
                  <button className="flex items-center gap-3 text-stone-900 font-black uppercase tracking-widest group-hover:gap-6 transition-all">
                    {dict.readMore} <ArrowRight className="text-green-600" size={24} />
                  </button>
                </article>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
