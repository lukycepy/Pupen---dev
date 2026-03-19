import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getDictionary } from '@/lib/get-dictionary';
import ScrollProgressBar from '../../components/ScrollProgressBar';
import SocialShareInline from '@/app/components/SocialShareInline';
import { ArrowLeft, Calendar, Clock, MapPin, Navigation, Ticket } from 'lucide-react';

function parseTimeline(description: string) {
  const lines = description
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const items = lines
    .map((l) => {
      const m = l.match(/^(\d{1,2}:\d{2})\s*(.*)$/);
      if (!m) return null;
      return { time: m[1], title: m[2] || '' };
    })
    .filter(Boolean) as { time: string; title: string }[];
  return items;
}

export async function generateMetadata({
  params,
}: {
  params: { lang: string; id: string };
}): Promise<Metadata> {
  const { lang, id } = params;
  const now = new Date().toISOString();
  const { data: event } = await supabase.from('events').select('*').eq('id', id).lte('published_at', now).maybeSingle();
  if (!event) return {};

  const title = lang === 'en' && event.title_en ? event.title_en : event.title;
  const description =
    (lang === 'en' ? (event.description_en || event.description) : event.description) ||
    (lang === 'en' ? 'Event by Pupen.' : 'Akce pořádaná spolkem Pupen.');

  const url = `https://pupen.org/${lang}/akce/${id}`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}/akce/${id}`,
      languages: {
        'cs-CZ': `/cs/akce/${id}`,
        'en-US': `/en/akce/${id}`,
      },
    },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
    },
  };
}

export default async function EventDetailPage({ params }: { params: { lang: string; id: string } }) {
  const { lang, id } = params;
  const dict = await getDictionary(lang);

  const now = new Date().toISOString();
  const { data: event } = await supabase.from('events').select('*').eq('id', id).lte('published_at', now).maybeSingle();
  if (!event) return notFound();

  const title = lang === 'en' && event.title_en ? event.title_en : event.title;
  const description = (lang === 'en' ? (event.description_en || event.description) : event.description) || '';
  const timeline = description ? parseTimeline(description) : [];

  const location = event.location || '';
  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  const appleMaps = `https://maps.apple.com/?q=${encodeURIComponent(location)}`;
  const waze = `https://waze.com/ul?q=${encodeURIComponent(location)}`;

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <ScrollProgressBar />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <Link
            href={`/${lang}/akce`}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
          >
            <ArrowLeft size={16} />
            {lang === 'en' ? 'Back to events' : 'Zpět na akce'}
          </Link>

          <Link
            href={`/${lang}/akce?rsvp=1#event-${event.id}`}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition shadow-lg shadow-green-600/20"
          >
            <Ticket size={16} />
            {lang === 'en' ? 'Register' : 'Registrovat'}
          </Link>
        </div>

        <div className="bg-white border border-stone-100 shadow-sm rounded-[3rem] p-10 md:p-16">
          <div className="space-y-6">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">
              {dict?.eventsPage?.title || (lang === 'en' ? 'Events' : 'Akce')}
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tight leading-none">{title}</h1>

            <div className="flex flex-wrap items-center gap-3">
              {event.date && (
                <span className="inline-flex items-center gap-2 bg-stone-50 border border-stone-100 px-4 py-2 rounded-xl text-sm font-bold text-stone-700">
                  <Calendar size={16} className="text-green-600" />
                  {new Date(event.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ')}
                </span>
              )}
              {event.time && (
                <span className="inline-flex items-center gap-2 bg-stone-50 border border-stone-100 px-4 py-2 rounded-xl text-sm font-bold text-stone-700">
                  <Clock size={16} className="text-green-600" />
                  {event.time}
                </span>
              )}
              {location && (
                <span className="inline-flex items-center gap-2 bg-stone-50 border border-stone-100 px-4 py-2 rounded-xl text-sm font-bold text-stone-700">
                  <MapPin size={16} className="text-green-600" />
                  {location}
                </span>
              )}
            </div>

            <div className="pt-2">
              <SocialShareInline title={title} />
            </div>
          </div>

          <div className="mt-12 grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 space-y-10">
              <section className="bg-stone-50 border border-stone-100 rounded-[2.5rem] p-8">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
                  {lang === 'en' ? 'About' : 'O akci'}
                </div>
                {description ? (
                  <div className="prose prose-stone max-w-none prose-p:leading-relaxed prose-headings:font-black prose-headings:tracking-tight prose-a:text-green-600">
                    {description.split('\n').map((p: string, idx: number) =>
                      p.trim() ? <p key={idx}>{p}</p> : null
                    )}
                  </div>
                ) : (
                  <div className="text-stone-400 font-bold uppercase tracking-widest text-xs">
                    {lang === 'en' ? 'No description yet.' : 'Zatím bez popisu.'}
                  </div>
                )}
              </section>

              {timeline.length > 0 && (
                <section className="bg-white border border-stone-100 rounded-[2.5rem] p-8 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-6">
                    {lang === 'en' ? 'Schedule' : 'Program'}
                  </div>
                  <div className="space-y-3">
                    {timeline.map((t, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                        <div className="w-16 shrink-0 text-center rounded-xl bg-white border border-stone-100 py-2 text-sm font-black text-stone-900">
                          {t.time}
                        </div>
                        <div className="font-bold text-stone-700">{t.title || (lang === 'en' ? 'Item' : 'Bod')}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="lg:col-span-5 space-y-6">
              <section className="bg-stone-50 border border-stone-100 rounded-[2.5rem] p-8">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
                  {lang === 'en' ? 'Location' : 'Místo'}
                </div>
                <div className="space-y-3">
                  <a
                    href={googleMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                  >
                    <Navigation size={16} />
                    Google Maps
                  </a>
                  <a
                    href={appleMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                  >
                    <Navigation size={16} />
                    Apple Maps
                  </a>
                  <a
                    href={waze}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                  >
                    <Navigation size={16} />
                    Waze
                  </a>
                </div>
              </section>

              <section className="bg-white border border-stone-100 rounded-[2.5rem] p-8 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
                  {lang === 'en' ? 'Quick actions' : 'Rychlé akce'}
                </div>
                <div className="space-y-3">
                  <Link
                    href={`/${lang}/akce?rsvp=1#event-${event.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-green-200 bg-green-600 text-white hover:bg-green-700 transition shadow-lg shadow-green-600/20"
                  >
                    <Ticket size={16} />
                    {lang === 'en' ? 'Register' : 'Registrovat'}
                  </Link>
                  <Link
                    href={`/${lang}/akce#event-${event.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
                  >
                    <ArrowLeft size={16} className="rotate-180" />
                    {lang === 'en' ? 'Open list view' : 'Otevřít seznam'}
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
