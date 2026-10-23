import Link from 'next/link';
import Image from 'next/image';

export default async function RomanPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';

  return (
    <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            href={`/${lang}`}
            className="text-xs font-black uppercase tracking-[0.25em] text-white/70 hover:text-white transition"
          >
            Zpět
          </Link>
          <div className="text-xs font-black uppercase tracking-[0.25em] text-white/40">roman</div>
        </div>

        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 shadow-2xl">
          <Image src="/img/roman.jpg" alt="Roman" width={750} height={500} className="w-full h-auto block" priority />
        </div>
      </div>
    </div>
  );
}
