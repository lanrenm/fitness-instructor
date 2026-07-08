/**
 * @description 用户信息服务 - 当前用户信息拉取
 */

/**
 * @description 后端 GET /auth/me 响应字段
 */
export interface ICurrentUser {
  /**
   * @description 用户 ID
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
  /**
   * @description 注册时间
   */
  createdAt: string;
  /**
   * @description 更新时间
   */
  updatedAt: string;
}

const BFF_BASE = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

/**
 * @description 用户信息服务
 */
export const userService = {
  /**
   * @description 获取当前登录用户信息（依赖已写入 accessToken）
   * @returns 当前用户信息
   * @throws 401 时 token 失效，调用方应清理 token 并跳 /login
   */
  async fetchCurrentUser(): Promise<ICurrentUser> {
    const accessToken =
      localStorage.getItem('accessToken') ?? null;

    const res = await fetch(`${BFF_BASE}/api/auth/me`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || '获取用户信息失败');
    }
    return res.json();
  },
};