'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Lock, Phone } from 'lucide-react';
// style-loader v4 + lazyStyleTag: see AuthPage/index.tsx for rationale.
import _styles from './index.module.css';
const styles = _styles.locals ?? _styles;

export interface AuthSuccessPayload {
  accessToken: string;
  refreshToken: string;
}

interface LoginFormProps {
  /** 由父组件传入：用于展示错误信息（错误展示在表单之外的卡片上） */
  onError: (message: string) => void;
  /** 登录成功后的回调：父组件负责存储 token 与跳转 */
  onSuccess: (data: AuthSuccessPayload) => void;
}

interface LoginData {
  phonenumber: string;
  password: string;
}

const INITIAL_DATA: LoginData = { phonenumber: '', password: '' };

export default function LoginForm({ onError, onSuccess }: LoginFormProps) {
  const [data, setData] = useState<LoginData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    onError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phonenumber: data.phonenumber,
          password: data.password,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || '登录失败');

      onSuccess(result);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.inputGroup}>
        <div className={styles.inputWrapper}>
          <Phone className={styles.inputIcon} />
          <input
            type="tel"
            name="phonenumber"
            value={data.phonenumber}
            onChange={handleChange}
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
            value={data.password}
            onChange={handleChange}
            className={styles.input}
            placeholder="密码"
            required
          />
          <span className={styles.requiredBadge}>*</span>
        </div>
      </div>
      <button type="submit" disabled={loading} className={styles.submitButton}>
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  );
}
