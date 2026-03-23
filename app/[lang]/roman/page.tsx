import Link from 'next/link';

const imagePrompt = encodeURIComponent(
  'foggy winter field with hoarfrost, lone person sitting on a wooden bench, muted grey tones, cinematic photo, shallow depth of field, natural light'
);

const imageUrl = `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${imagePrompt}&image_size=landscape_16_9`;

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
          <img src={imageUrl} alt="Roman" className="w-full h-auto block" />

          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
            <div
              className="text-center text-white font-black uppercase tracking-tight leading-none"
              style={{
                fontSize: 'clamp(22px, 4vw, 44px)',
                textShadow:
                  '0 4px 0 rgba(0,0,0,0.95), 0 -4px 0 rgba(0,0,0,0.95), 4px 0 0 rgba(0,0,0,0.95), -4px 0 0 rgba(0,0,0,0.95), 3px 3px 0 rgba(0,0,0,0.95), -3px 3px 0 rgba(0,0,0,0.95), 3px -3px 0 rgba(0,0,0,0.95), -3px -3px 0 rgba(0,0,0,0.95)'
              }}
            >
              POV: ČEKÁŠ AŽ LUKÁŠ DODĚLÁ PUPEN WEB
            </div>
            <div className="absolute left-4 bottom-3 text-[10px] text-white/60 font-medium">imgflip.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}
