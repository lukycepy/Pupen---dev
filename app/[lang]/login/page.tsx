import LoginPageClient from './LoginPageClient';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return <LoginPageClient lang={lang || 'cs'} />;
}
