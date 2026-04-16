import React from 'react';

export default function DbContentPage({ title, html }: { title?: string | null; html?: string | null }) {
  const t = String(title || '').trim();
  const body = String(html || '').trim();

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-white rounded-[3rem] border border-stone-100 shadow-sm p-10 md:p-14">
          {t ? <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight mb-8">{t}</h1> : null}
          {body ? <div className="prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: body }} /> : null}
        </div>
      </div>
    </div>
  );
}

