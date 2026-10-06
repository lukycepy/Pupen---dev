import WaitlistOfferClient from './WaitlistOfferClient';

export default async function WaitlistOfferPage({
  params,
}: {
  params: Promise<{ lang: string; token: string }>;
}) {
  const { lang, token } = await params;
  return <WaitlistOfferClient lang={lang === 'en' ? 'en' : 'cs'} token={token} />;
}
