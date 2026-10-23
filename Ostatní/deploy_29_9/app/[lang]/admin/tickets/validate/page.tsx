import ValidateTicketClient from './ValidateTicketClient';

export default async function AdminTicketValidatePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <ValidateTicketClient lang={lang || 'cs'} />;
}
