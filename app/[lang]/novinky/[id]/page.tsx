// app/novinky/[id]/page.tsx
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Calendar, Clock, Newspaper } from 'lucide-react';
import { getDictionary } from '@/lib/get-dictionary';
import { Metadata } from 'next';
import ScrollProgressBar from '../../components/ScrollProgressBar';
import SocialShareInline from '@/app/components/SocialShareInline';

export const revalidate = 60;

interface Props {
  params: Promise<{ id: string; lang: string }>;
}

function escapeHtml(input: any) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function markdownToHtml(raw: string) {
  const lines = raw.split('\n');
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const lineRaw of lines) {
    const line = lineRaw.replace(/\r/g, '');
    if (!line.trim()) {
      closeList();
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      closeList();
      out.push(`<h3>${escapeHtml(h3[1])}</h3>`);
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      closeList();
      out.push(`<h2>${escapeHtml(h2[1])}</h2>`);
      continue;
    }
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      closeList();
      out.push(`<h1>${escapeHtml(h1[1])}</h1>`);
      continue;
    }

    const li = line.match(/^\-\s+(.+)$/);
    if (li) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${escapeHtml(li[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${escapeHtml(line.trim())}</p>`);
  }
  closeList();
  return out.join('\n');
}

function toHtml(raw: string) {
  if (!raw) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
  return looksLikeHtml ? raw : markdownToHtml(raw);
}

function injectHeadingIdsAndToc(html: string) {
  const used = new Map<string, number>();
  const toc: Array<{ id: string; text: string; level: number }> = [];

  const nextHtml = html.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (m, lvlRaw, attrs, inner) => {
    const level = Number(lvlRaw);
    const hasId = /\sid=["'][^"']+["']/.test(attrs);
    const text = String(inner).replace(/<[^>]*>/g, '').trim();
    if (!text) return m;

    let id = '';
    if (hasId) {
      const mm = String(attrs).match(/\sid=["']([^"']+)["']/i);
      id = mm?.[1] || '';
    }
    if (!id) {
      const base = slugify(text) || 'section';
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      id = count === 1 ? base : `${base}-${count}`;
    }

    if (level >= 2) toc.push({ id, text, level });
    const attrsNext = hasId ? attrs : `${attrs} id="${id}"`;
    return `<h${level}${attrsNext}>${inner}</h${level}>`;
  });

  return { html: nextHtml, toc };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, lang } = await params;
  const { data: post } = await supabase.from('posts').select('*').eq('id', id).single();
  
  if (!post) return {};

  const title = lang === 'en' && post.title_en ? post.title_en : post.title;
  const description = lang === 'en' && post.excerpt_en ? post.excerpt_en : post.excerpt;

  return {
    title: `${title} | Studentský spolek Pupen, z.s.`,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: post.image_url ? [post.image_url] : [],
      type: 'article',
    },
  };
}

export default async function DetailNovinky({ params }: Props) {
  // --- KLÍČOVÁ OPRAVA: params se musí awaitovat ---
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const lang = resolvedParams.lang || 'cs';

  const dict = await getDictionary(lang);

  // Dotaz do Supabase
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  // Ošetření chyb a neexistujícího ID
  if (error || !post) {
    notFound();
  }

  const rawContent = lang === 'en' && post.content_en ? post.content_en : post.content;
  const { html: contentHtml, toc } = injectHeadingIdsAndToc(toHtml(rawContent || ''));

  return (
    <div className="min-h-screen bg-white font-sans">
      <ScrollProgressBar />
{/* Zmenšili jsme min-h na 250px a vh na 15vh */}
<header className="relative h-[15vh] min-h-[250px] w-full bg-stone-900 overflow-hidden">
  {post.image_url ? (
    <Image 
      src={post.image_url} 
      alt={post.title} 
      fill
      priority
      className="object-cover opacity-50 transition-opacity duration-500"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
      <Newspaper size={60} strokeWidth={1} />
    </div>
  )}
  
  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/90 via-black/40 to-transparent">
    {/* Snížili jsme spodní padding (pb-8) a zmenšili mezery (mb-4) */}
    <div className="mx-auto w-full max-w-4xl px-6 pb-8">
      <Link 
        href={`/${lang}/novinky`} 
        className="mb-4 inline-flex items-center gap-2 font-bold text-white/70 hover:text-green-400 transition group text-sm"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
        {dict.newsPage?.backBtn || (lang === 'cs' ? 'Zpět na přehled' : 'Back to overview')}
      </Link>
      
      <div className="mb-3">
         <span className="rounded-lg bg-green-600 px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-white shadow-lg">
           {(dict.categories as any)?.[post.category] || post.category || (lang === 'cs' ? 'Novinka' : 'News')}
         </span>
      </div>
      
      {/* Zmenšili jsme písmo nadpisu pro lepší vyváženost (text-3xl na mobilu / text-5xl na desktopu) */}
      <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-tight drop-shadow-md">
        {lang === 'en' && post.title_en ? post.title_en : post.title}
      </h1>
    </div>
  </div>
</header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-6 border-b border-stone-100 pb-10 mb-12 text-stone-400 text-[10px] font-black uppercase tracking-widest">
          <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-lg">
            <Calendar size={16} className="text-green-600" />
            {new Date(post.created_at).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-lg">
            <Clock size={16} className="text-green-600" />
            {dict.newsPage?.detailTitle || (lang === 'cs' ? 'Detailní článek' : 'Detail article')}
          </div>
        </div>

        <div className="mb-12">
          <SocialShareInline title={lang === 'en' && post.title_en ? post.title_en : post.title} />
        </div>

        <div className="grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-8">
            <article className="prose prose-stone lg:prose-xl max-w-none prose-p:leading-relaxed prose-headings:font-black prose-headings:tracking-tight prose-img:rounded-3xl prose-a:text-green-600">
              {(lang === 'en' ? (post.excerpt_en || post.excerpt) : post.excerpt) && (
                <div 
                  className="text-2xl md:text-3xl font-bold text-stone-700 leading-tight mb-12 border-l-8 border-green-500 pl-8 py-2 rich-text-excerpt"
                  dangerouslySetInnerHTML={{ __html: lang === 'en' && post.excerpt_en ? post.excerpt_en : post.excerpt }}
                />
              )}

              <div 
                className="text-stone-800 leading-[1.8] text-lg md:text-xl font-medium"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            </article>
          </div>

          {toc.length > 0 && (
            <aside className="lg:col-span-4 lg:sticky lg:top-28">
              <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
                  {lang === 'en' ? 'Contents' : 'Obsah'}
                </div>
                <div className="space-y-2">
                  {toc.map((t) => (
                    <a
                      key={t.id}
                      href={`#${t.id}`}
                      className={`block text-sm font-bold hover:text-green-700 transition ${
                        t.level === 3 ? 'pl-4 text-stone-600' : 'text-stone-800'
                      }`}
                    >
                      {t.text}
                    </a>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
