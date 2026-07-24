/**
 * @description 用户信息服务 - 当前用户信息拉取
 */

import { tryAuthedFetch, isUnauthorized } from './http';
import { AuthExpiredError } from './http';

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

/**
 * @description 用户信息服务
 */
export const userService = {
  /**
   * @description 获取当前登录用户信息（依赖已写入 accessToken）
   * @returns 当前用户信息
   * @throws AuthExpiredError refresh 仍失败时（已被 tryAuthedFetch 转为强制登出）
   */
  async fetchCurrentUser(): Promise<ICurrentUser> {
    try {
      const res = await tryAuthedFetch('/api/auth/me');
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || '获取用户信息失败');
      }
      return res.json();
    } catch (err) {
      if (isUnauthorized(err)) throw err;
      // tryAuthedFetch 在 refresh 失败时已强制登出 + 抛 AuthExpiredError；
      // 这里如果拿到的是普通 Error（首请求非 401，或其他 fetch 错），保持原行为。
      throw err;
    }
  },
};