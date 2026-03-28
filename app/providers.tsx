'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import RouteLoadingBar from './components/RouteLoadingBar';

const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then((m) => m.ReactQueryDevtools),
  { ssr: false },
);

function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes (increased from 1 minute)
        refetchOnWindowFocus: false, // Less refetching
        retry: 1, // Fewer retries
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouteLoadingBar />
        <ScrollToTop />
        {children}
        {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </ToastProvider>
    </QueryClientProvider>
  );
}
