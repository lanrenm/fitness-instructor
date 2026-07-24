/**
 * @description 顶部栏浮岛：左侧 logo + 模块切换，右侧用户信息。
 * 当前模块由 URL 前缀解出，命中即点亮（橙色 pill 底）。
 * 用户名走 GET /auth/me（userService.fetchCurrentUser），失败/未登录时
 * 退到占位常量；训练状态文案仍是占位（后续接训练统计接口）。
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, ChevronDown, User, LogOut } from 'lucide-react';
import _styles from './TopBar.module.css';
import { cn } from '@fitness/ui-components';
import { MODULES, findModuleByPath } from '../../config/modules';
import { authService } from '../../services/authService';
import { userService } from '../../services/userService';

interface ITopBarProps {
  /** 当前用户姓名（占位常量，真实数据来自 /auth/me） */
  userName?: string;
  /** 当前用户训练状态文案（占位常量，后续接训练统计） */
  trainingStatus?: string;
}

export default function TopBar({
  userName = '健身达人',
  trainingStatus = '今日已训练 45 分钟',
}: ITopBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeModule = findModuleByPath(pathname);

  const [displayName, setDisplayName] = useState<string>(userName);
  const [menuOpen, setMenuOpen] = useState(false);
  const rightGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authService.isAuthenticated()) return;
    let cancelled = false;
    userService
      .fetchCurrentUser()
      .then((u) => {
        if (!cancelled && u.name) setDisplayName(u.name);
      })
      .catch(() => {
        // 401/网络失败都保持占位常量，避免闪烁
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 点击菜单外部关闭
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (rightGroupRef.current && !rightGroupRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleTabClick = (basePath: string) => {
    // 各模块默认跳到它第一个子菜单项
    const mod = MODULES.find((m) => m.basePath === basePath);
    const target = mod?.children[0]?.path ?? basePath;
    navigate(target);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    // 与 401/refresh 失败走同一路径：forceLogout → 清 token → 通知监听器
    // → AuthSessionBridge 清 query cache 并 navigate('/login')。
    authService.forceLogout('user-initiated');
  };

  return (
    <header className={_styles.bar}>
      <div className={_styles.leftGroup}>
        <div className={_styles.logoWrap}>
          <div className={_styles.logoCircle} aria-hidden>
            <Activity size={22} strokeWidth={2.5} />
          </div>
          <span className={_styles.logoText}>FitFlow</span>
        </div>

        <div className={_styles.divider} />

        <nav className={_styles.moduleSwitcher} role="tablist" aria-label="应用模块">
          {MODULES.map((m) => {
            const isActive = activeModule?.id === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cn(_styles.tab, isActive && _styles.tabActive)}
                onClick={() => handleTabClick(m.basePath)}
              >
                <Icon className={_styles.tabIcon} aria-hidden />
                <span>{m.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className={_styles.rightGroup} ref={rightGroupRef}>
        <button
          type="button"
          className={_styles.rightTrigger}
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="用户菜单"
        >
          <div className={_styles.userInfo}>
            <span className={_styles.userName}>{displayName}</span>
            <span className={_styles.userStatus}>{trainingStatus}</span>
          </div>
          <div className={_styles.avatar} aria-label={`${displayName} 头像`}>
            <User size={20} strokeWidth={2.2} aria-hidden />
          </div>
          <ChevronDown className={_styles.chevron} aria-hidden />
        </button>

        {menuOpen && (
          <div role="menu" className={_styles.userMenu}>
            <button
              type="button"
              role="menuitem"
              data-topbar-logout=""
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-[#FED7D7] bg-white px-4 py-2 text-sm font-medium text-[#C53030] hover:bg-[#FFF5F5]"
            >
              <LogOut size={14} />
              退出登录
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
