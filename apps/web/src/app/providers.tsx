import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { createQueryClient } from '../lib/api/queryClient'

const queryClient = createQueryClient()

export function Providers({
  client = queryClient,
  children,
}: {
  client?: QueryClient
  children: ReactNode
}) {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}
