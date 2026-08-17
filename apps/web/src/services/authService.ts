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

/**
 * @description 强制登出原因。
 * - refresh-failed：refresh token 也失效，401 恢复流程放弃
 * - user-initiated：用户主动点击「退出登录」
 * - expired-token：本地检测到 accessToken 过期（预留）
 */
export interface IForceLogoutReason {
  reason: 'refresh-failed' | 'user-initiated' | 'expired-token';
}

const BFF_BASE = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

/**
 * @description 内存兜底存储（用于 localStorage 不可用场景，例如 Safari 隐私模式 / 配额超限）
 */
let memoryTokens: { accessToken: string; refreshToken: string } | null = null;

/**
 * @description refresh 单飞：多个并发 401 只触发一次 /api/auth/refresh，
 * 其余调用共享同一个 in-flight promise。settle 后在 finally 里复位为 null。
 */
let refreshInflight: Promise<boolean> | null = null;

/**
 * @description 强制登出监听器集合。forceLogout 时依次通知，用于清 query 缓存、
 * 跳 /login、在登录页展示原因横幅等。
 */
const forceLogoutListeners = new Set<(reason: IForceLogoutReason['reason']) => void>();

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
   * @description 检查是否已认证。解析 accessToken 的 exp 字段（无签名校验，
   * 服务端仍会强制校验）。exp 距今 < 1 分钟视为过期，避免本地比服务端更早拒绝。
   * @returns 是否已登录且 accessToken 未过期
   */
  isAuthenticated(): boolean {
    const t = this.getAccessToken();
    if (!t) return false;
    try {
      const payload = JSON.parse(atob(t.split('.')[1])) as { exp?: number };
      return !payload.exp || payload.exp * 1000 > Date.now() + 60_000;
    } catch {
      return false;
    }
  },

  /**
   * @description 刷新 accessToken。单飞：并发调用共享同一个 in-flight promise。
   * refreshToken 不存在或服务端返回非 2xx → 返回 false。
   * @returns 是否成功刷新
   */
  async refreshAccessToken(): Promise<boolean> {
    if (refreshInflight) return refreshInflight;
    const rt = this.getRefreshToken();
    if (!rt) return false;
    refreshInflight = (async () => {
      try {
        const res = await fetch(`${BFF_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        this.setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInflight = null;
      }
    })();
    return refreshInflight;
  },

  /**
   * @description 强制登出：清 token + 通知所有监听器。
   * 监听器（AuthSessionBridge）负责清 query cache 并 navigate('/login')。
   * @param reason 触发原因
   */
  forceLogout(reason: IForceLogoutReason['reason']): void {
    this.clearTokens();
    memoryTokens = null;
    forceLogoutListeners.forEach((l) => l(reason));
  },

  /**
   * @description 注册强制登出监听器。
   * @param fn 监听器回调
   * @returns 取消订阅函数
   */
  onForceLogout(fn: (reason: IForceLogoutReason['reason']) => void): () => void {
    forceLogoutListeners.add(fn);
    return () => {
      forceLogoutListeners.delete(fn);
    };
  },
};