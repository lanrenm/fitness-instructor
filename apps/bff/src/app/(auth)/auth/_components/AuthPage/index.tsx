'use client';

import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { cn } from '@fitness/ui-components';
import BrandingSection from '../BrandingSection';
import LoginForm, { type AuthSuccessPayload } from '../LoginForm';
import RegisterForm from '../RegisterForm';
import { useAuthMode } from '../../_hooks/useAuthMode';
import styles from './index.module.css';

interface AuthPageProps {
  /** 登录/注册成功后由父组件决定 token 存储与跳转 */
  onSuccess: (data: AuthSuccessPayload) => void;
}

export default function AuthPage({ onSuccess }: AuthPageProps) {
  const [error, setError] = useState('');
  const { isLogin, animating, animDirection, switchMode } = useAuthMode();

  const handleSwitchMode = (toLogin: boolean) => {
    setError('');
    switchMode(toLogin);
  };

  return (
    <>
      <BrandingSection />

      <div className={styles.container}>
        <div className={cn(styles.card, isLogin ? styles.loginHeight : styles.registerHeight)}>
          <div className={styles.logo}>
            <Dumbbell className={styles.logoIcon} />
          </div>

          <div className={styles.header}>
            <div
              className={cn(
                styles.titleWrapper,
                animating && (animDirection === 'up' ? styles.slideUp : styles.slideDown),
              )}
            >
              <h1 className={styles.title}>{isLogin ? '欢迎回来' : '创建账户'}</h1>
              <p className={styles.subtitle}>
                {isLogin ? '登录您的账户继续健身之旅' : '开启您的健身之旅'}
              </p>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div
            className={cn(
              styles.formContainer,
              animating && (animDirection === 'up' ? styles.fadeUp : styles.fadeDown),
            )}
          >
            {isLogin ? (
              <LoginForm onError={setError} onSuccess={onSuccess} />
            ) : (
              <RegisterForm onError={setError} onSuccess={onSuccess} />
            )}
          </div>

          <div className={styles.footer}>
            <span className={styles.footerText}>
              {isLogin ? '还没有账户？' : '已有账户？'}
            </span>
            <button type="button" onClick={() => handleSwitchMode(!isLogin)} className={styles.link}>
              {isLogin ? '立即注册' : '立即登录'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
