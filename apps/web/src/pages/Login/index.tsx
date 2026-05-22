import { useEffect } from 'react';

/**
 * @description LoginPage - 登录页面，跳转至 BFF 进行认证
 */
export default function LoginPage() {
  const BFF_AUTH_URL = `${import.meta.env.VITE_BFF_URL || 'http://localhost:3000'}/auth`;

  useEffect(() => {
    // 跳转到 BFF 认证页
    window.location.href = BFF_AUTH_URL;
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>正在跳转到登录页面...</p>
    </div>
  );
}