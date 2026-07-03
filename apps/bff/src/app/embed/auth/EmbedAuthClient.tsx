'use client';

import AuthPage from '@/remote/auth/_components/AuthPage';
import type { AuthSuccessPayload } from '@/remote/auth/_components/LoginForm';

/**
 * Client-side wrapper that owns the onSuccess callback. page.tsx (a
 * server component) can't define functions and pass them to client
 * components, so this wrapper exists as the client boundary. The
 * actual success handling (postMessage / CustomEvent propagation)
 * lands here in Step 2a.
 */
export default function EmbedAuthClient() {
  const handleSuccess = (data: AuthSuccessPayload) => {
    // Step 1 stub. Step 2a will dispatch a CustomEvent from the
    // shadow root so the host can capture the token.
    // eslint-disable-next-line no-console
    console.log('[bff embed] auth success:', data);
  };

  return <AuthPage onSuccess={handleSuccess} />;
}
