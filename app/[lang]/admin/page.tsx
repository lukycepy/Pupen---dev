'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';

  useEffect(() => {
    router.replace(`/${lang}/login`);
  }, [router, lang]);

  return null;
}
