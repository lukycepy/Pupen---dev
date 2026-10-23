import { Suspense } from 'react';
import TrustBoxPageClient from './TrustBoxPageClient';

export default function TrustBoxPage() {
  return (
    <Suspense fallback={null}>
      <TrustBoxPageClient />
    </Suspense>
  );
}
