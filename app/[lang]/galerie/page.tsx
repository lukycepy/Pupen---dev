'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getDictionary } from '@/lib/get-dictionary';
import { supabase } from '@/lib/supabase';
import { Image as ImageIcon, Calendar, ArrowLeft, Maximize2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function GaleriePage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  
  const [galleries, setGalleries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dict, setDict] = useState<any>(null);

  useEffect(() => {
    getDictionary(lang).then(d => setDict(d.gallery));
  }, [lang]);

  useEffect(() => {
    async function loadGalleries() {
      const { data } = await supabase
        .from('galleries')
        .select(`
          *,
          gallery_images (
            image_url
          )
        `)
        .order('created_at', { ascending: false });
      setGalleries(data || []);
      setLoading(false);
    }
    loadGalleries();
  }, []);

  if (!dict) return null;

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-7xl mx-auto px-6">
        <header className="mb-16">
          <Link href={`/${lang}`} className="inline-flex items-center gap-2 text-stone-400 font-bold hover:text-green-600 transition mb-6 group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> {lang === 'cs' ? 'Zpět domů' : 'Back home'}
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-2xl shadow-sm">
              <ImageIcon size={32} />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter">{dict.title}</h1>
          </div>
          <p className="text-stone-500 text-lg max-w-2xl font-medium">{dict.subtitle}</p>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => <div key={i} className="aspect-[4/3] bg-stone-200 animate-pulse rounded-[2.5rem]" />)}
          </div>
        ) : (
          <div className="space-y-24">
            {galleries.map((gallery) => (
              <section key={gallery.id} className="space-y-8">
                <div className="flex items-end justify-between border-b border-stone-200 pb-6">
                  <div>
                    <h2 className="text-3xl font-black text-stone-900 mb-2">{lang === 'en' && gallery.title_en ? gallery.title_en : gallery.title}</h2>
                    <p className="text-stone-400 font-bold flex items-center gap-2 uppercase tracking-widest text-[10px]">
                      <Calendar size={12} /> {new Date(gallery.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="bg-stone-100 text-stone-500 px-4 py-2 rounded-full text-xs font-bold">{gallery.gallery_images?.length || 0} {dict.photosCount}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {gallery.gallery_images?.map((img: any, idx: number) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedImage(img.image_url)}
                      className="aspect-square relative rounded-[1.5rem] overflow-hidden group cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
                    >
                      {/^https?:\/\//.test(String(img.image_url)) ? (
                        <img
                          src={String(img.image_url)}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-110"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Image src={img.image_url} alt="" fill className="object-cover transition duration-700 group-hover:scale-110" />
                      )}
                      <div className="absolute inset-0 bg-green-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-white/90 backdrop-blur-md p-3 rounded-full scale-50 group-hover:scale-100 transition-transform duration-500">
                          <Maximize2 className="text-green-600" size={20} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 bg-stone-900/95 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-8 right-8 text-white/50 hover:text-white transition p-2"
          >
            <X size={40} />
          </button>
          <div className="relative w-full max-w-6xl aspect-[3/2]">
            {/^https?:\/\//.test(String(selectedImage)) ? (
              <img src={String(selectedImage)} alt="" className="absolute inset-0 w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Image src={selectedImage} alt="" fill className="object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
