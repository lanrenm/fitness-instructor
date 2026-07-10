import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/index.css';
import { router } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// The federation plugin's HTML entry proxy already awaits `initHost()`
// (which populates __mfModuleCache.share) and preloads the
// `bff_auth/AuthPage` remote before importing this file. See the
// injected script `/@id/__x00__virtual:mf-html-entry-proxy?...` in the
// served index.html — Vite replaces the original <script src="/src/main.tsx">
// tag with that proxy.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);