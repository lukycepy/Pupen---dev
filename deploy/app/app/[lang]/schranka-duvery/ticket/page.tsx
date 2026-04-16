import { Suspense } from 'react';
import TrustBoxTicketClient from './TrustBoxTicketClient';

export default function TrustBoxTicketPage() {
  return (
    <Suspense fallback={null}>
      <TrustBoxTicketClient />
    </Suspense>
  );
}
