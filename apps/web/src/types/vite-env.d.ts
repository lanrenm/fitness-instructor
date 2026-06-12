/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

// ⚠️ This shim is a hand-maintained mirror of the BFF's AuthSuccessPayload.
// Source of truth: apps/bff/src/remote/auth/_components/LoginForm/index.tsx (export interface AuthSuccessPayload)
// Keep in sync if the BFF type changes. The remote boundary is structural, not type-checked.
declare module 'bff_auth/AuthPage' {
  import type { ComponentType } from 'react';

  interface AuthSuccessPayload {
    accessToken: string;
    refreshToken: string;
  }

  type AuthPageProps = {
    onSuccess: (data: AuthSuccessPayload) => void;
  };

  const AuthPage: ComponentType<AuthPageProps>;
  export default AuthPage;
}
