'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell } from 'lucide-react';
import { cn } from '@fitness/ui-components';
import styles from './auth.module.css';
import BrandingSection from './_components/BrandingSection';
import LoginForm, { type AuthSuccessPayload } from './_components/LoginForm';
import RegisterForm from './_components/RegisterForm';
import { useAuthMode } from './_hooks/useAuthMode';

export default function AuthPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { isLogin, animating, animDirection, switchMode } = useAuthMode();

  // 登录/注册成功后由后端返回 token，父组件统一处理存储与跳转
  const handleAuthSuccess = (data: AuthSuccessPayload) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    router.push('/');
  };

  // 切换模式前先清空错误，错误信息展示在卡片上、表单外，避免随表单动画淡出
  const handleSwitchMode = (toLogin: boolean) => {
    setError('');
    switchMode(toLogin);
  };

  return (
    <>
      {/* Branding Section */}
      <BrandingSection />

      {/* Auth Card */}
      <div className={styles.container}>
        <div className={cn(styles.card, isLogin ? styles.loginHeight : styles.registerHeight)}>
          {/* Logo */}
          <div className={styles.logo}>
            <Dumbbell className={styles.logoIcon} />
          </div>

          {/* Animated Header */}
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

          {/* Animated Form Container */}
          <div
            className={cn(
              styles.formContainer,
              animating && (animDirection === 'up' ? styles.fadeUp : styles.fadeDown),
            )}
          >
            {isLogin ? (
              <LoginForm onError={setError} onSuccess={handleAuthSuccess} />
            ) : (
              <RegisterForm onError={setError} onSuccess={handleAuthSuccess} />
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
