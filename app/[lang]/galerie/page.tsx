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
  const isSafeImageSrc = (value: unknown) => {
    if (typeof value !== 'string') return false;
    if (!value) return false;
    if (value.startsWith('/')) return true;
    return /^https?:\/\//.test(value);
  };
  
  const [galleries, setGalleries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dict, setDict] = useState<any>(null);
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    getDictionary(lang).then(d => setDict(d.gallery));
  }, [lang]);

  useEffect(() => {
    async function loadGalleries() {
      const nowIso = new Date().toISOString();
      const toUnified = (items: any[]) =>
        (items || []).map((g: any) => ({
          ...g,
          year: typeof g?.year === 'number' ? g.year : new Date(g.created_at).getFullYear(),
        }));

      try {
        const resAlbums: any = await supabase
          .from('gallery_albums')
          .select(
            `
              id,
              title,
              description,
              year,
              created_at,
              cover_image_url,
              gallery_photos (
                image_url,
                caption,
                sort_order,
                created_at
              )
            `
          )
          .eq('is_public', true)
          .order('year', { ascending: false })
          .order('created_at', { ascending: false });

        if (resAlbums?.error) {
          const msg = String(resAlbums.error.message || '');
          if (/relation .*gallery_albums.*does not exist|does not exist/i.test(msg)) {
            const queryGalleries = async (withPublishedFilter: boolean) => {
              let q = supabase
                .from('galleries')
                .select(
                  `
                    *,
                    gallery_images (
                      image_url
                    )
                  `
                )
                .order('created_at', { ascending: false });
              if (withPublishedFilter) q = (q as any).not('published_at', 'is', null).lte('published_at', nowIso);
              return q;
            };

            let resLegacy: any = await queryGalleries(true);
            if (resLegacy?.error) {
              const msg2 = String(resLegacy.error.message || '');
              if (/published_at/i.test(msg2)) {
                resLegacy = await queryGalleries(false);
              }
            }
            if (resLegacy?.error) {
              const msg2 = String(resLegacy.error.message || '');
              if (/relation .*galleries.*does not exist|does not exist/i.test(msg2)) {
                const alt = await supabase.from('gallery').select('*').order('created_at', { ascending: false }).limit(200);
                if (!alt.error) {
                  const items = (alt.data || [])
                    .map((r: any) => ({ image_url: r.image_url }))
                    .filter((x: any) => x.image_url);
                  setGalleries(
                    toUnified([
                      {
                        id: 'all',
                        title: lang === 'en' ? 'Gallery' : 'Galerie',
                        title_en: 'Gallery',
                        created_at: new Date().toISOString(),
                        gallery_images: items,
                      },
                    ])
                  );
                  return;
                }
              }
              setGalleries([]);
              return;
            }

            setGalleries(toUnified(resLegacy.data || []));
            return;
          }

          setGalleries([]);
          return;
        }

        const unifiedAlbums = toUnified(
          (resAlbums.data || []).map((a: any) => ({
            id: a.id,
            title: a.title,
            title_en: a.title_en,
            description: a.description,
            created_at: a.created_at,
            year: a.year,
            gallery_images: (a.gallery_photos || [])
              .slice()
              .sort((x: any, y: any) => {
                const xs = typeof x.sort_order === 'number' ? x.sort_order : 0;
                const ys = typeof y.sort_order === 'number' ? y.sort_order : 0;
                if (xs !== ys) return xs - ys;
                return new Date(y.created_at).getTime() - new Date(x.created_at).getTime();
              })
              .map((p: any) => ({ image_url: p.image_url, caption: p.caption })),
          }))
        );
        setGalleries(unifiedAlbums);
      } finally {
        setLoading(false);
      }
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
          <div className="space-y-10">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setYearFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                  yearFilter === 'all' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {lang === 'en' ? 'All years' : 'Vše'}
              </button>
              {Array.from(new Set(galleries.map((g) => g.year).filter(Boolean)))
                .sort((a: any, b: any) => Number(b) - Number(a))
                .map((y: any) => (
                  <button
                    key={String(y)}
                    type="button"
                    onClick={() => setYearFilter(Number(y))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                      yearFilter === Number(y) ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {String(y)}
                  </button>
                ))}
            </div>

            <div className="space-y-24">
              {Array.from(new Set(galleries.map((g) => g.year).filter(Boolean)))
                .sort((a: any, b: any) => Number(b) - Number(a))
                .filter((y: any) => yearFilter === 'all' || Number(y) === Number(yearFilter))
                .map((y: any) => {
                  const items = galleries.filter((g) => Number(g.year) === Number(y));
                  if (!items.length) return null;
                  return (
                    <section key={String(y)} className="space-y-10">
                      <div className="flex items-center justify-between">
                        <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight">{String(y)}</h2>
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                          {items.reduce((acc: number, g: any) => acc + (g.gallery_images?.length || 0), 0)} {dict.photosCount}
                        </span>
                      </div>

                      {items.map((gallery) => (
                        <div key={gallery.id} className="space-y-8">
                          <div className="flex items-end justify-between border-b border-stone-200 pb-6">
                            <div>
                              <h3 className="text-2xl font-black text-stone-900 mb-2">
                                {lang === 'en' && gallery.title_en ? gallery.title_en : gallery.title}
                              </h3>
                              <p className="text-stone-400 font-bold flex items-center gap-2 uppercase tracking-widest text-[10px]">
                                <Calendar size={12} />{' '}
                                {new Date(gallery.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}
                              </p>
                            </div>
                            <span className="bg-stone-100 text-stone-500 px-4 py-2 rounded-full text-xs font-bold">
                              {gallery.gallery_images?.length || 0} {dict.photosCount}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {gallery.gallery_images?.map((img: any, idx: number) => (
                              <div
                                key={idx}
                                onClick={() => setSelectedImage(img.image_url)}
                                className="aspect-square relative rounded-[1.5rem] overflow-hidden group cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
                              >
                                {isSafeImageSrc(String(img.image_url ?? '')) ? (
                                  String(img.image_url).startsWith('http') ? (
                                    <img
                                      src={String(img.image_url)}
                                      alt=""
                                      className="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-110"
                                      loading="lazy"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <Image
                                      src={img.image_url}
                                      alt=""
                                      fill
                                      className="object-cover transition duration-700 group-hover:scale-110"
                                    />
                                  )
                                ) : null}
                                <div className="absolute inset-0 bg-green-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="bg-white/90 backdrop-blur-md p-3 rounded-full scale-50 group-hover:scale-100 transition-transform duration-500">
                                    <Maximize2 className="text-green-600" size={20} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </section>
                  );
                })}
            </div>
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
            {isSafeImageSrc(String(selectedImage ?? '')) ? (
              String(selectedImage).startsWith('http') ? (
                <img src={String(selectedImage)} alt="" className="absolute inset-0 w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <Image src={selectedImage} alt="" fill className="object-contain" />
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
