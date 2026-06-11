'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Lock, Phone, User } from 'lucide-react';
import type { AuthSuccessPayload } from '../LoginForm';
import styles from './index.module.css';

interface RegisterFormProps {
  /** 由父组件传入：用于展示错误信息（错误展示在表单之外的卡片上） */
  onError: (message: string) => void;
  /** 注册成功后的回调：父组件负责存储 token 与跳转 */
  onSuccess: (data: AuthSuccessPayload) => void;
}

interface RegisterData {
  phonenumber: string;
  name: string;
  password: string;
  confirmPassword: string;
}

const INITIAL_DATA: RegisterData = {
  phonenumber: '',
  name: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterForm({ onError, onSuccess }: RegisterFormProps) {
  const [data, setData] = useState<RegisterData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    onError('');

    if (data.password !== data.confirmPassword) {
      onError('两次输入的密码不一致');
      return;
    }
    if (data.password.length < 6) {
      onError('密码至少需要6个字符');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phonenumber: data.phonenumber,
          name: data.name,
          password: data.password,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || '注册失败');

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
          <User className={styles.inputIcon} />
          <input
            type="text"
            name="name"
            value={data.name}
            onChange={handleChange}
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
            value={data.password}
            onChange={handleChange}
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
            value={data.confirmPassword}
            onChange={handleChange}
            className={styles.input}
            placeholder="确认密码"
            required
          />
          <span className={styles.requiredBadge}>*</span>
        </div>
      </div>
      <button type="submit" disabled={loading} className={styles.submitButton}>
        {loading ? '注册中...' : '注册'}
      </button>
    </form>
  );
}
