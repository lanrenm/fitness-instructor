'use client';

import { useCallback, useState } from 'react';

type AnimDirection = 'up' | 'down';

interface UseAuthModeReturn {
  isLogin: boolean;
  animating: boolean;
  animDirection: AnimDirection;
  switchMode: (toLogin: boolean) => void;
}

/**
 * 封装登录/注册模式的切换与切换动画状态。
 *
 * - `isLogin` 决定当前展示哪个表单
 * - `animating` + `animDirection` 驱动标题与表单容器的过渡动画
 * - 切换分两段：150ms 后切换 `isLogin`（DOM 替换），400ms 后结束动画
 */
export function useAuthMode(initialIsLogin: boolean = true): UseAuthModeReturn {
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [animating, setAnimating] = useState(false);
  const [animDirection, setAnimDirection] = useState<AnimDirection>('up');

  const switchMode = useCallback(
    (toLogin: boolean) => {
      if (toLogin === isLogin) return;
      setAnimDirection(toLogin ? 'down' : 'up');
      setAnimating(true);
      setTimeout(() => {
        setIsLogin(toLogin);
      }, 150);
      setTimeout(() => {
        setAnimating(false);
      }, 400);
    },
    [isLogin],
  );

  return { isLogin, animating, animDirection, switchMode };
}
