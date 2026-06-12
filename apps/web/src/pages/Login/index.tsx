import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface AuthSuccessPayload {
  accessToken: string;
  refreshToken: string;
}

type AuthPageProps = {
  onSuccess: (data: AuthSuccessPayload) => void;
};

type AuthPageComponent = ComponentType<AuthPageProps>;

export default function LoginPage() {
  const { login } = useAuth();
  const [AuthPage, setAuthPage] = useState<AuthPageComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingMemoryStorage, setUsingMemoryStorage] = useState(false);

  const loadAuthPage = async () => {
    setLoadError(null);
    try {
      const mod = await import('bff_auth/AuthPage');
      setAuthPage(() => mod.default);
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setLoadError(message);
    }
  };

  useEffect(() => {
    loadAuthPage();
  }, []);

  const handleAuthSuccess = (data: AuthSuccessPayload) => {
    const { mode } = login(data.accessToken, data.refreshToken);
    if (mode === 'memory') {
      setUsingMemoryStorage(true);
    }
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        <p className="text-red-500 text-center">
          认证模块加载失败：{loadError}
        </p>
        <button
          onClick={loadAuthPage}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          点击重试
        </button>
      </div>
    );
  }

  if (!AuthPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <>
      {usingMemoryStorage && (
        <div
          role="status"
          className="fixed top-0 left-0 right-0 z-50 bg-yellow-100 border-b border-yellow-300 text-yellow-900 text-sm text-center py-2 px-4"
        >
          当前浏览器禁用了本地存储，登录态仅在当前页面有效，刷新后需重新登录。
        </div>
      )}
      <AuthPage onSuccess={handleAuthSuccess} />
    </>
  );
}
