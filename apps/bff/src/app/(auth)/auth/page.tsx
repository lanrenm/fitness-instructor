'use client';

import { useRouter } from 'next/navigation';
import AuthPage from './_components/AuthPage';
import { type AuthSuccessPayload } from './_components/LoginForm';

export default function Page() {
  const router = useRouter();

  const handleAuthSuccess = (data: AuthSuccessPayload) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    router.push('/');
  };

  return <AuthPage onSuccess={handleAuthSuccess} />;
}
