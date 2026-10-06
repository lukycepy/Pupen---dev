import React, { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';

export default async function ResetPasswordPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <ResetPasswordClient lang={lang} />
    </Suspense>
  );
}
