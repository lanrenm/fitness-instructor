/**
 * @description 根级组件：订阅 authService.onForceLogout，触发时清空 react-query
 * 缓存并 navigate('/login')，同时把最近一次 forceLogout 原因写入
 * AuthSessionContext，便于登录页展示「上次会话已过期」横幅。
 *
 * 作为 <RouterProvider router={...}/> 的根 element：内部用 <Outlet/> 渲染
 * 真实路由树。必须挂在 QueryClientProvider 之内（useQueryClient）以及
 * RouterProvider 之内（useNavigate）。
 */
import { useEffect, useState, createContext, useContext } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/authService';

type ForceLogoutReason = 'refresh-failed' | 'user-initiated' | 'expired-token';

interface IAuthSessionContext {
  /** 最近一次 forceLogout 的原因；尚未发生则为 null */
  lastReason: ForceLogoutReason | null;
}

const AuthSessionContext = createContext<IAuthSessionContext>({ lastReason: null });

/**
 * @description 供登录页消费的 hook：读取最近一次 forceLogout 原因。
 */
export function useAuthSession(): IAuthSessionContext {
  return useContext(AuthSessionContext);
}

/**
 * @description 根级 Bridge：清缓存 + 跳 /login + 暴露 reason 给子树。
 */
export default function AuthSessionBridge() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lastReason, setLastReason] = useState<ForceLogoutReason | null>(null);

  useEffect(() => {
    const unsubscribe = authService.onForceLogout((reason) => {
      // 清空 react-query 缓存，避免 stale 数据在 /login 页面闪烁
      queryClient.clear();
      setLastReason(reason);
      // 跳 /login（replace:true 防止回退又触发 PublicRoute 再次重定向）
      navigate('/login', { replace: true });
    });
    return unsubscribe;
  }, [navigate, queryClient]);

  return (
    <AuthSessionContext.Provider value={{ lastReason }}>
      <Outlet />
    </AuthSessionContext.Provider>
  );
}