'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@zihin/ui/tooltip'

export function Providers({ children }: { children: ReactNode }) {
  // QueryClient render başına bir kez oluşturulur; SSR sırasında istekler arasında paylaşılmaz.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4000 }} />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
