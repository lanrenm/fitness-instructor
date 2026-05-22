/**
 * @description 路由配置
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { authService } from '../services/authService';
import LoginPage from '../pages/Login';
import HomePage from '../pages/Home';

/**
 * @description 受保护的路由组件 - 未登录时跳转到登录页
 */
function ProtectedRoute({ children }: IProtectedRouteProps) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/**
 * @description 公开路由组件 - 已登录时跳转到首页
 */
function PublicRoute({ children }: IPublicRouteProps) {
  if (authService.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/**
 * @description 受保护的路由组件-传参
 */
interface IProtectedRouteProps {
  /**
   * @description 子元素
   */
  children: React.ReactNode;
}

/**
 * @description 公开路由组件-传参
 */
interface IPublicRouteProps {
  /**
   * @description 子元素
   */
  children: React.ReactNode;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <HomePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
]);