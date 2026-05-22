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
   * @description 获取访问令牌
   * @returns 令牌字符串或 null
   */
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  },

  /**
   * @description 存储令牌
   * @param accessToken 访问令牌
   * @param refreshToken 刷新令牌
   */
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  /**
   * @description 清除令牌
   */
  clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  /**
   * @description 检查是否已认证
   * @returns 是否已登录
   */
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },
};