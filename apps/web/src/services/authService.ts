/**
 * @description 认证服务 - 处理登录、注册、Token 管理
 */

/**
 * @description 登录请求参数
 */
interface ILoginData {
  /**
   * @description 手机号
   */
  phonenumber: string;
  /**
   * @description 密码
   */
  password: string;
}

/**
 * @description 注册请求参数
 */
interface IRegisterData {
  /**
   * @description 手机号
   */
  phonenumber: string;
  /**
   * @description 昵称
   */
  name: string;
  /**
   * @description 密码
   */
  password: string;
}

/**
 * @description 认证响应结果
 */
interface IAuthResponse {
  /**
   * @description 访问令牌
   */
  accessToken: string;
  /**
   * @description 刷新令牌
   */
  refreshToken: string;
  /**
   * @description 用户信息
   */
  user: {
    /**
     * @description 用户ID
     */
    id: string;
    /**
     * @description 手机号
     */
    phonenumber: string;
    /**
     * @description 昵称
     */
    name: string | null;
  };
}

const BFF_BASE = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

/**
 * @description 内存兜底存储（用于 localStorage 不可用场景，例如 Safari 隐私模式 / 配额超限）
 */
let memoryTokens: { accessToken: string; refreshToken: string } | null = null;

/**
 * @description 认证服务
 */
export const authService = {
  /**
   * @description 登录
   * @param data 登录参数
   * @returns 认证响应
   */
  async login(data: ILoginData): Promise<IAuthResponse> {
    const res = await fetch(`${BFF_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || '登录失败');
    }
    return res.json();
  },

  /**
   * @description 注册
   * @param data 注册参数
   * @returns 认证响应
   */
  async register(data: IRegisterData): Promise<IAuthResponse> {
    const res = await fetch(`${BFF_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || '注册失败');
    }
    return res.json();
  },

  /**
   * @description 获取访问令牌（localStorage 优先，回退到内存）
   * @returns 令牌字符串或 null
   */
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken') ?? memoryTokens?.accessToken ?? null;
  },

  /**
   * @description 存储令牌
   * @description 先写入内存兜底，再尝试 localStorage；任一失败不抛出
   * @param accessToken 访问令牌
   * @param refreshToken 刷新令牌
   * @returns 存储模式：'local' 表示 localStorage 写入成功，'memory' 表示降级到内存
   */
  setTokens(accessToken: string, refreshToken: string): { mode: 'local' | 'memory' } {
    memoryTokens = { accessToken, refreshToken };
    try {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      return { mode: 'local' };
    } catch {
      return { mode: 'memory' };
    }
  },

  /**
   * @description 清除令牌（同时清理 localStorage 与内存兜底）
   */
  clearTokens(): void {
    memoryTokens = null;
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } catch {
      // localStorage 不可用时内存兜底已通过 memoryTokens = null 清理
    }
  },

  /**
   * @description 获取刷新令牌（localStorage 优先，回退到内存）
   * @returns 令牌字符串或 null
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken') ?? memoryTokens?.refreshToken ?? null;
  },

  /**
   * @description 检查是否已认证
   * @returns 是否已登录
   */
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },
};