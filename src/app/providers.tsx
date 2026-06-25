'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { Toaster } from 'sonner';
import { RealtimeProvider } from '@/contexts/RealtimeContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider refetchInterval={10} refetchOnWindowFocus={true}>
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          {children}
          <ProgressBar height="2px" color="#ffffff" options={{ showSpinner: false }} shallowRouting />
          <Toaster position="top-center" theme="dark" duration={2000} />
        </RealtimeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
