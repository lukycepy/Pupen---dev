'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React, { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';

import { usePathname } from 'next/navigation';
import RouteLoadingBar from './components/RouteLoadingBar';

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
        <DevToolsWrapper />
      </ToastProvider>
    </QueryClientProvider>
  );
}

function DevToolsWrapper() {
  const [isDev, setIsDev] = useState(false);
  
  useEffect(() => {
    setIsDev(
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    );
  }, []);

  if (!isDev) return null;
  return <ReactQueryDevtools initialIsOpen={false} />;
}
