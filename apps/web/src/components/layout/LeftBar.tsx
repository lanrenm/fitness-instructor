/**
 * @description 左侧浮岛 — 当前模块子菜单 + 本周进度卡。
 * 当前模块由 URL 前缀解出（与 TopBar 共用 findModuleByPath）；
 * 子菜单项的 active 态按 pathname 完全相等判断。
 * 本周进度卡用占位常量，step 4 接真实数据。
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@fitness/ui-components';
import { findModuleByPath } from '../../config/modules';
import _styles from './LeftBar.module.css';

interface ILeftBarProps {
  /** 本周已训练天数（占位常量，step 4 接 /me/stats） */
  trainedDays?: number;
  /** 本周目标天数（占位常量） */
  targetDays?: number;
}

export default function LeftBar({
  trainedDays = 4,
  targetDays = 5,
}: ILeftBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeModule = findModuleByPath(pathname);
  const children = activeModule?.children ?? [];
  const fillPercent = Math.min(100, Math.round((trainedDays / targetDays) * 100));

  return (
    <aside className={_styles.bar} aria-label="侧边菜单">
      <div className={_styles.moduleHeader}>
        {activeModule?.label ?? '菜单'}
      </div>

      <nav className={_styles.menuList}>
        {children.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(_styles.menuItem, isActive && _styles.menuItemActive)}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => navigate(item.path)}
            >
              <Icon className={_styles.menuIcon} aria-hidden />
              <span className={_styles.menuLabel}>{item.label}</span>
              {item.badge != null && (
                <span className={_styles.menuBadge}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className={_styles.weeklyCard}>
        <div className={_styles.weeklyTitle}>本周进度</div>
        <div className={_styles.weeklyRow}>
          <span>训练天数</span>
          <span className={_styles.weeklyCount}>
            {trainedDays}/{targetDays}
          </span>
        </div>
        <div className={_styles.weeklyTrack} aria-hidden>
          <div
            className={_styles.weeklyFill}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>
    </aside>
  );
}