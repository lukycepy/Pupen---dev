import GuardianConsentClient from './GuardianConsentClient';

export default async function GuardianConsentPage({
  params,
}: {
  params: Promise<{ lang: string; token: string }>;
}) {
  const { lang, token } = await params;
  return <GuardianConsentClient lang={lang === 'en' ? 'en' : 'cs'} token={token} />;
}
