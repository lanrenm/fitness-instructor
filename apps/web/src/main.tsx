import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './styles/index.css';
import { router } from './routes';

// The federation plugin's HTML entry proxy already awaits `initHost()`
// (which populates __mfModuleCache.share) and preloads the
// `bff_auth/AuthPage` remote before importing this file. See the
// injected script `/@id/__x00__virtual:mf-html-entry-proxy?...` in the
// served index.html — Vite replaces the original <script src="/src/main.tsx">
// tag with that proxy.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
