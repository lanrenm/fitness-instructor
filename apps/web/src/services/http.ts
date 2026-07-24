/**
 * @description 统一的认证请求层。所有受保护 BFF 接口都应走 tryAuthedFetch，
 * 由它在 401 时透明触发 refresh + retry；refresh 失败则强制登出并抛
 * AuthExpiredError，调用方可用 instanceof 区分。
 */
import { authService } from './authService';

const BFF_BASE = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

/**
 * @description 认证过期错误。tryAuthedFetch 在 refresh 失败或用户主动登出时抛出，
 * 便于调用方通过 instanceof 区分「已强制登出」与普通请求失败。
 */
export class AuthExpiredError extends Error {
  constructor(public readonly reason: 'refresh-failed' | 'user-initiated') {
    super('AUTH_EXPIRED');
    this.name = 'AuthExpiredError';
  }
}

/**
 * @description 判定错误是否为认证过期错误。
 * @param err 任意错误
 * @returns err 是否为 AuthExpiredError
 */
export function isUnauthorized(err: unknown): err is AuthExpiredError {
  return err instanceof AuthExpiredError;
}

/**
 * @description 带 Bearer 的 fetch。不做任何 401 恢复，仅负责拼接 base + 注入 token。
 * @param path BFF 相对路径（以 / 开头）
 * @param init fetch 参数
 * @returns 原始 Response
 */
export function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = authService.getAccessToken();
  return fetch(`${BFF_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * @description 带 401 恢复的 fetch。
 * - 首个响应非 401 → 原样返回。
 * - 401 → 触发 authService.refreshAccessToken()（单飞）：
 *   - 成功 → 用 authedFetch 重试一次并返回重试结果。
 *   - 失败 → authService.forceLogout('refresh-failed') 并抛 AuthExpiredError。
 * @param path BFF 相对路径（以 / 开头）
 * @param init fetch 参数
 * @returns 原始 Response（首个或重试）
 * @throws AuthExpiredError refresh 失败时
 */
export async function tryAuthedFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await authedFetch(path, init);
  if (res.status !== 401) return res;

  const refreshed = await authService.refreshAccessToken();
  if (refreshed) {
    return authedFetch(path, init);
  }

  authService.forceLogout('refresh-failed');
  throw new AuthExpiredError('refresh-failed');
}
