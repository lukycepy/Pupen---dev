import AdminEntryClient from './AdminEntryClient';

export default async function AdminLogin({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return <AdminEntryClient lang={lang || 'cs'} />;
}
