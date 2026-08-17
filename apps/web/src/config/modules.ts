/**
 * 应用模块与子菜单元数据。
 *
 * 单一来源：TopBar（模块切换）/ LeftBar（当前模块子菜单）/ 路由配置
 * 都从这里派生。新增模块时：补一段、TopBar 和 LeftBar 自动联动；
 * 子菜单项是新路由时再去 routes/index.tsx 加一条。
 */
import {
  Award,
  BarChart3,
  CalendarDays,
  Dumbbell,
  Home,
  LayoutDashboard,
  MessageSquare,
  PieChart,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

/**
 * @description 子菜单项元数据
 */
export interface IMenuItem {
  /** 子菜单 ID（用于 key） */
  id: string;
  /** 显示的中文 label */
  label: string;
  /** 路由完整路径 */
  path: string;
  /** lucide-react 图标组件 */
  icon: LucideIcon;
  /** 可选右侧数字徽标 */
  badge?: number;
}

/**
 * @description 模块元数据（TopBar 一项 = 一个模块）
 */
export interface IModule {
  id: string;
  label: string;
  icon: LucideIcon;
  /** 该模块所有子路径的公共前缀，例如 '/overview' */
  basePath: string;
  /** 子菜单项；>=1 时 LeftBar 渲染菜单列表 */
  children: IMenuItem[];
}

/**
 * @description 模块 + 子菜单配置。顺序就是 TopBar 从左到右的顺序。
 */
export const MODULES: IModule[] = [
  {
    id: 'overview',
    label: '概览',
    icon: Home,
    basePath: '/overview',
    children: [
      {
        id: 'dashboard',
        label: '仪表盘',
        path: '/overview/dashboard',
        icon: LayoutDashboard,
      },
      {
        id: 'calendar',
        label: '训练日历',
        path: '/overview/calendar',
        icon: CalendarDays,
      },
      {
        id: 'achievements',
        label: '成就系统',
        path: '/overview/achievements',
        icon: Award,
      },
    ],
  },
  {
    id: 'training',
    label: '训练管理',
    icon: Dumbbell,
    basePath: '/training',
    children: [
      {
        id: 'exercises',
        label: '动作管理',
        path: '/training/exercises',
        icon: Dumbbell,
      },
      {
        id: 'muscle-groups',
        label: '肌肉群管理',
        path: '/training/muscle-groups',
        icon: PieChart,
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI 顾问',
    icon: Sparkles,
    basePath: '/ai',
    children: [
      {
        id: 'chat',
        label: '智能问答',
        path: '/ai/chat',
        icon: MessageSquare,
      },
      {
        id: 'plan',
        label: '计划推荐',
        path: '/ai/plan',
        icon: TrendingUp,
      },
    ],
  },
  {
    id: 'data',
    label: '数据分析',
    icon: BarChart3,
    basePath: '/data',
    children: [
      {
        id: 'data-overview',
        label: '训练概览',
        path: '/data/overview',
        icon: BarChart3,
      },
      {
        id: 'data-exercises',
        label: '动作分析',
        path: '/data/exercises',
        icon: TrendingUp,
      },
    ],
  },
];

/**
 * @description 根据当前 pathname 找出对应的模块（basePath 前缀命中）
 * @returns 命中的模块，未命中返回 null
 */
export function findModuleByPath(pathname: string): IModule | null {
  return (
    MODULES.find((m) => pathname === m.basePath || pathname.startsWith(`${m.basePath}/`)) ??
    null
  );
}
