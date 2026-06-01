'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Lock, User, Dumbbell } from 'lucide-react';
import { cn } from '@fitness/ui-components';
import styles from './auth.module.css';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animating, setAnimating] = useState(false);
  const [animDirection, setAnimDirection] = useState<'up' | 'down'>('up');

  const [loginData, setLoginData] = useState({ phonenumber: '', password: '' });
  const [registerData, setRegisterData] = useState({
    phonenumber: '',
    name: '',
    password: '',
    confirmPassword: '',
  });

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegisterData({ ...registerData, [e.target.name]: e.target.value });
  };

  const switchForm = (toLogin: boolean) => {
    if (toLogin === isLogin) return;
    setError('');
    setLoginData({ phonenumber: '', password: '' });
    setRegisterData({ phonenumber: '', name: '', password: '', confirmPassword: '' });
    setAnimDirection(toLogin ? 'down' : 'up');
    setAnimating(true);
    setTimeout(() => {
      setIsLogin(toLogin);
    }, 150);
    setTimeout(() => {
      setAnimating(false);
    }, 400);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phonenumber: loginData.phonenumber,
          password: loginData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '登录失败');

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (registerData.password !== registerData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (registerData.password.length < 6) {
      setError('密码至少需要6个字符');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phonenumber: registerData.phonenumber,
          name: registerData.name,
          password: registerData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '注册失败');

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Branding Section */}
      <div className={styles.brandingSection}>
        <h2>开启您的<br />健身之旅</h2>
        <p>记录训练轨迹，科学管理饮食，让每一次进步都清晰可见</p>
        <div className={styles.featureList}>
          <div className={styles.featureItem}>
            <span className={styles.featureDot} />
            <span>个性化训练计划</span>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.featureDot} />
            <span>动作库查询</span>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.featureDot} />
            <span>AI 智能计划调整</span>
          </div>
        </div>
      </div>

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
                animating && (animDirection === 'up' ? styles.slideUp : styles.slideDown)
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
              animating && (animDirection === 'up' ? styles.fadeUp : styles.fadeDown)
            )}
          >
            {isLogin ? (
              <form onSubmit={handleLogin} className={styles.form}>
                <div className={styles.inputGroup}>
                  <div className={styles.inputWrapper}>
                    <Phone className={styles.inputIcon} />
                    <input
                      type="tel"
                      name="phonenumber"
                      value={loginData.phonenumber}
                      onChange={handleLoginChange}
                      className={styles.input}
                      placeholder="手机号"
                      required
                    />
                    <span className={styles.requiredBadge}>*</span>
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} />
                    <input
                      type="password"
                      name="password"
                      value={loginData.password}
                      onChange={handleLoginChange}
                      className={styles.input}
                      placeholder="密码"
                      required
                    />
                    <span className={styles.requiredBadge}>*</span>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={styles.submitButton}
                >
                  {loading ? '登录中...' : '登录'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className={styles.form}>
                <div className={styles.inputGroup}>
                  <div className={styles.inputWrapper}>
                    <Phone className={styles.inputIcon} />
                    <input
                      type="tel"
                      name="phonenumber"
                      value={registerData.phonenumber}
                      onChange={handleRegisterChange}
                      className={styles.input}
                      placeholder="手机号"
                      required
                    />
                    <span className={styles.requiredBadge}>*</span>
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <div className={styles.inputWrapper}>
                    <User className={styles.inputIcon} />
                    <input
                      type="text"
                      name="name"
                      value={registerData.name}
                      onChange={handleRegisterChange}
                      className={styles.input}
                      placeholder="昵称"
                      required
                    />
                    <span className={styles.requiredBadge}>*</span>
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} />
                    <input
                      type="password"
                      name="password"
                      value={registerData.password}
                      onChange={handleRegisterChange}
                      className={styles.input}
                      placeholder="密码"
                      required
                    />
                    <span className={styles.requiredBadge}>*</span>
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={registerData.confirmPassword}
                      onChange={handleRegisterChange}
                      className={styles.input}
                      placeholder="确认密码"
                      required
                    />
                    <span className={styles.requiredBadge}>*</span>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={styles.submitButton}
                >
                  {loading ? '注册中...' : '注册'}
                </button>
              </form>
            )}
          </div>

          <div className={styles.footer}>
            <span className={styles.footerText}>
              {isLogin ? '还没有账户？' : '已有账户？'}
            </span>
            <button type="button" onClick={() => switchForm(!isLogin)} className={styles.link}>
              {isLogin ? '立即注册' : '立即登录'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}