/**
 * @description 路由配置。所有受保护路由统一通过 AppLayout 套壳层（TopBar + LeftBar + Outlet），
 * PublicRoute 仍负责未登录访问 /login 时把已登录用户 forward 到默认模块首页。
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { authService } from '../services/authService';
import AuthSessionBridge from '../auth/AuthSessionBridge';
import LoginPage from '../pages/Login';
import AppLayout from '../components/layout/AppLayout';
import OverviewDashboard from '../pages/Layout/Overview/Dashboard';
import OverviewCalendar from '../pages/Layout/Overview/Calendar';
import OverviewAchievements from '../pages/Layout/Overview/Achievements';
import TrainingExercises from '../pages/Layout/Training/Exercises';
import TrainingMuscleGroups from '../pages/Layout/Training/MuscleGroups';
import AIChat from '../pages/Layout/AI/Chat';
import AIPlan from '../pages/Layout/AI/Plan';
import DataOverview from '../pages/Layout/Data/Overview';
import DataExercises from '../pages/Layout/Data/Exercises';

/**
 * @description 受保护的路由元素。未登录跳 /login。
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/**
 * @description 公开路由元素。已登录时跳到默认模块首页（避免重复进登录页）。
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  if (authService.isAuthenticated()) {
    return <Navigate to="/overview/dashboard" replace />;
  }
  return <>{children}</>;
}

/**
 * @description 模块 index → 该模块第一个子菜单项的重定向。
 * @param to 子菜单路径
 */
function ModuleIndex({ to }: { to: string }) {
  return <Navigate to={to} replace />;
}

export const router = createBrowserRouter([
  // 根级：AuthSessionBridge 订阅 onForceLogout，自身渲染 <Outlet/>
  // 包裹下面所有路由（公开 + 受保护）。这样无论在哪个页面 token 过期，
  // bridge 都会清 query cache 并 navigate('/login')。
  {
    element: <AuthSessionBridge />,
    children: [
      // 公开：登录页（不带 AppLayout）
      {
        path: '/login',
        element: (
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        ),
      },

      // 受保护：套 AppLayout 壳层，内部按模块嵌套子路由
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          // 根路径 → 概览/仪表盘（登录后默认落点）
          { index: true, element: <Navigate to="/overview/dashboard" replace /> },

          // 概览
          {
            path: 'overview',
            children: [
              { index: true, element: <ModuleIndex to="/overview/dashboard" /> },
              { path: 'dashboard', element: <OverviewDashboard /> },
              { path: 'calendar', element: <OverviewCalendar /> },
              { path: 'achievements', element: <OverviewAchievements /> },
            ],
          },

          // 训练管理
          {
            path: 'training',
            children: [
              { index: true, element: <ModuleIndex to="/training/exercises" /> },
              { path: 'exercises', element: <TrainingExercises /> },
              { path: 'muscle-groups', element: <TrainingMuscleGroups /> },
            ],
          },

          // AI 顾问
          {
            path: 'ai',
            children: [
              { index: true, element: <ModuleIndex to="/ai/chat" /> },
              { path: 'chat', element: <AIChat /> },
              { path: 'plan', element: <AIPlan /> },
            ],
          },

          // 数据分析
          {
            path: 'data',
            children: [
              { index: true, element: <ModuleIndex to="/data/overview" /> },
              { path: 'overview', element: <DataOverview /> },
              { path: 'exercises', element: <DataExercises /> },
            ],
          },
        ],
      },
    ],
  },
]);
