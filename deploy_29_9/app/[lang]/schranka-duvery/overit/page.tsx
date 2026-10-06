import { Suspense } from 'react';
import TrustBoxVerifyClient from './TrustBoxVerifyClient';

export default function TrustBoxVerifyPage() {
  return (
    <Suspense fallback={null}>
      <TrustBoxVerifyClient />
    </Suspense>
  );
}
