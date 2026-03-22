import React, { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';

export default function ResetPasswordPage({ params }: { params: { lang: string } }) {
  const lang = params?.lang === 'en' ? 'en' : 'cs';
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <ResetPasswordClient lang={lang} />
    </Suspense>
  );
}
