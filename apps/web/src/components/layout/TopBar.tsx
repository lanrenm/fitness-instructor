/**
 * @description 顶部栏浮岛：左侧 logo + 模块切换，右侧用户信息。
 * 当前模块由 URL 前缀解出，命中即点亮（橙色 pill 底）。
 * 用户信息为占位常量，step 4 接入 GET /auth/me 后改成真实数据。
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, ChevronDown, User } from 'lucide-react';
import _styles from './TopBar.module.css';
import { cn } from '@fitness/ui-components';
import { MODULES, findModuleByPath } from '../../config/modules';

interface ITopBarProps {
  /** 当前用户姓名（占位常量，step 4 接 /auth/me） */
  userName?: string;
  /** 当前用户训练状态文案（占位常量） */
  trainingStatus?: string;
}

export default function TopBar({
  userName = '健身达人',
  trainingStatus = '今日已训练 45 分钟',
}: ITopBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeModule = findModuleByPath(pathname);

  const handleTabClick = (basePath: string) => {
    // 各模块默认跳到它第一个子菜单项
    const mod = MODULES.find((m) => m.basePath === basePath);
    const target = mod?.children[0]?.path ?? basePath;
    navigate(target);
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

      <div className={_styles.rightGroup}>
        <div className={_styles.userInfo}>
          <span className={_styles.userName}>{userName}</span>
          <span className={_styles.userStatus}>{trainingStatus}</span>
        </div>
        <div className={_styles.avatar} aria-label={`${userName} 头像`}>
          <User size={20} strokeWidth={2.2} aria-hidden />
        </div>
        <ChevronDown className={_styles.chevron} aria-hidden />
      </div>
    </header>
  );
}
