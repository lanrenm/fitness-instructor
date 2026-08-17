# Auth Recovery: 401 handling + logout + stale-token guard

**Date:** 2026-07-24

## Goal

Eliminate the "stuck on 401 with no recovery" failure mode the user hit: after `accessToken` (15 min) expires, the muscle-groups page (and every other protected page) keeps getting 401 forever because nothing refreshes the token, no UI surfaces the failure, and there is no logout. The user also cannot navigate to `/login` to recover because `PublicRoute` short-circuits any time `localStorage.accessToken` exists — even if that token is expired.

After this fix, on any 401 from a BFF API call:

1. The app transparently calls `/api/auth/refresh` once (single-flight) and retries the original request.
2. If refresh succeeds, the user sees no error.
3. If refresh fails (refresh token expired too), tokens are cleared and the user is sent to `/login` with a toast/banner explaining what happened.
4. The user can always log out from any protected page (top-bar dropdown button that calls the same cleanup path).
5. `PublicRoute` treats tokens older than 1 minute from expiry as unauthenticated (cheap local check), so a stale-token session does not mask the need to re-login.

## Why this is happening now

Tokens in `auth.service.ts`:
- `accessToken` TTL = `15m` (`auth.service.ts:96`)
- `refreshToken` TTL = `7d` (`auth.service.ts:97`)
- `getRefreshToken()` is defined but **never called anywhere** (`authService.ts:158`).
- `userService.fetchCurrentUser` throws `UNAUTHORIZED` on 401 but does NOT trigger refresh (`userService.ts:50`).
- `muscleGroupsService.list` / `create` / `update` / `remove` throw raw `Error(message)` on 401 (`muscleGroupsService.ts:40,46,52,58,64`).
- No global fetch interceptor / axios middleware exists.
- `ProtectedRoute` and `PublicRoute` both branch on `authService.isAuthenticated()` which is `!!this.getAccessToken()` — i.e. presence, not validity.
- No logout UI in `TopBar.tsx` or any other component.

User's reported scenario: 1+ week since login → refresh token also expired → repeated 401 → no recovery path → appears as "all requests 401".

## Approved design

### 1. Add a single `authedFetch` interceptor (the canonical request layer)

Create `apps/web/src/services/http.ts` exporting:

- `authedFetch(path: string, init?: RequestInit): Promise<Response>` — same signature as the local helper currently inlined in each service. Does:

  1. Read `accessToken` from `authService`.
  2. If `!accessToken` → `fetch(BFF_BASE + path, init)`. (Don't auto-redirect — the calling service may be the login or refresh itself.)
  3. Else `fetch(BFF_BASE + path, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) } })`.

- `tryAuthedFetch(path: string, init?: RequestInit): Promise<Response>` — wraps `authedFetch` with 401-recovery:

  1. First attempt via `authedFetch`.
  2. If response is **not** 401, return as-is.
  3. If 401: ask `tokenRefresher` (singleton, see below) to refresh.
  4. If refresh succeeded: re-call `authedFetch` once and return the retry result.
  5. If refresh failed: call `forceLogout()` and rethrow a tagged error so callers can `instanceof` distinguish.

- `isUnauthorized(err): err is AuthExpiredError` — small predicate.

Refactor **all five current inline `authedFetch` definitions** (`muscleGroupsService.ts`, `userService.ts`, and the three other service files that fetch with `BFF_BASE` — `overviewService.ts`, `useRecentSessions.ts`, `useOverviewStats.ts`, `useOverviewIntensity.ts`) to use `tryAuthedFetch` instead. This is a net deletion of code, no behavior change for the success path.

### 2. Single-flight token refresher

In `authService.ts`, add:

```ts
let refreshInflight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  // single-flight: if already refreshing, share the same promise
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
      const data = await res.json() as { accessToken: string; refreshToken: string };
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}
```

Expose `refreshAccessToken` and `forceLogout` (see §3) on the `authService` object.

### 3. Force-logout helper

```ts
function forceLogout(reason: 'refresh-failed' | 'expired-token'): void {
  this.clearTokens();                 // localStorage + memory
  memoryTokens = null;
  // notify listeners so we can:
  //   - drop the in-memory query cache (so stale data doesn't render)
  //   - navigate to /login via router outside the auth module
  forceLogoutListeners.forEach(l => l(reason));
}
```

`forceLogoutListeners` is a Set<(reason) => void> populated via `authService.onForceLogout(fn)`.

Two callers register at boot:

- In `routes/index.tsx` (or a small `src/auth/AuthSessionBridge.tsx` component mounted near the root): subscribes to force-logout, on event clears the `queryClient` cache, then `useNavigate()('/login')`.
- In `LoginPage` / a top-level error display (see §5): updates a small context with the last force-logout reason so the login page can show "上次会话已过期，请重新登录".

### 4. Stale-token guard in `isAuthenticated()`

`isAuthenticated()` is called by `ProtectedRoute` and `PublicRoute` on every render of `<RouterProvider>`. Cheapest correct version:

```ts
isAuthenticated(): boolean {
  const t = this.getAccessToken();
  if (!t) return false;
  // decode payload (best-effort, no signature check — server still enforces it)
  try {
    const payload = JSON.parse(atob(t.split('.')[1])) as { exp?: number };
    return !payload.exp || payload.exp * 1000 > Date.now() + 60_000;  // 1-min skew
  } catch {
    return false;  // malformed token → treat as unauthenticated
  }
}
```

The 1-minute skew is intentional: a token that expires right *now* would still be valid server-side for a few hundred ms; inverting that into a buffer avoids a race where the local check rejects a token the server would still accept (which would cause a needless 401 → refresh).

This unblocks the user's secondary complaint: visiting `/login` with a stale token now goes to `/login` instead of looping to `/overview/dashboard`.

### 5. Logout button in TopBar

Add a dropdown next to the user name in `apps/web/src/components/layout/TopBar.tsx` (currently shows demo user name). On click → `authService.forceLogout('user-initiated')`. The same `forceLogout` path is used, which means the bridge in §3 cleans the query cache and navigates to `/login` automatically — single code path for all logout scenarios (token-expired, user-clicks-logout, server-revoked).

No new component required — a single `<button onClick={() => authService.forceLogout('user-initiated')}>退出登录</button>` is enough. Style: same `bg-white text-[#C53030]` destructive border treatment used in `MuscleGroupDetailDialog`'s footer button (already in the `@source inline` class list).

### 6. Latent bug fix: JWT payload mismatch

`auth.service.ts:94` builds payload `{ sub, phonenumber }` but `jwt.strategy.ts:6-8` declares `JwtPayload { sub, email }` and `validate()` returns `{ userId, email: undefined }`. While not the cause of the user's 401 (the guard passes either way), it means `@CurrentUser()` is broken for any controller that uses `.email`. Fix: include `email` in the payload (read from `user.email`).

While there, change `JwtPayload` to be `{ sub: string; phonenumber: string; email: string }` and have `validate()` return `{ userId, phonenumber, email }`. Update `auth.controller.ts`'s `@CurrentUser()` parameter type to match.

## Files modified

| File | Change |
| --- | --- |
| `apps/web/src/services/authService.ts` | Add `refreshAccessToken`, `forceLogout`, `onForceLogout`, expire-aware `isAuthenticated`, `Bearer` header on refresh attempt |
| `apps/web/src/services/http.ts` | **NEW** — `authedFetch` + `tryAuthedFetch` + `AuthExpiredError` |
| `apps/web/src/services/muscleGroupsService.ts` | Replace inline helper with `tryAuthedFetch` |
| `apps/web/src/services/userService.ts` | Replace inline helper; rethrow `AuthExpiredError` instead of generic `Error('UNAUTHORIZED')` |
| `apps/web/src/services/overviewService.ts` | Replace inline helper |
| `apps/web/src/hooks/useOverviewIntensity.ts` | Inline helper → `tryAuthedFetch` |
| `apps/web/src/hooks/useOverviewStats.ts` | Inline helper → `tryAuthedFetch` |
| `apps/web/src/hooks/useRecentSessions.ts` | Inline helper → `tryAuthedFetch` |
| `apps/web/src/routes/index.tsx` (or new `AuthSessionBridge.tsx` near root) | Subscribe to `forceLogout`, clear `queryClient`, navigate to `/login` |
| `apps/web/src/components/layout/TopBar.tsx` | Add logout button next to user name |
| `apps/api/src/common/strategies/jwt.strategy.ts` | Add `phonenumber` to `JwtPayload` and `validate()` return |
| `apps/api/src/modules/auth/auth.service.ts` | Include `email` in JWT payload |
| `apps/api/src/modules/auth/auth.controller.ts` | Update `@CurrentUser()` parameter type |

## Files NOT modified

- `apps/api/src/modules/muscle-groups/*` — no server changes needed; existing refresh endpoint already exists.
- UI components unrelated to auth.

## Verification

1. **401 → refresh → retry (happy path)**. Use a short-lived access token in dev (or simply call `forceLogout('expired-token')` after a manual token delete to simulate). Make any BFF request; expect: 1× refresh POST, then retry succeeds. Verify a single flight: clear access token, fire 5 parallel requests, expect exactly 1 refresh POST.
2. **401 → refresh fails → force logout**. Refresh token cleared from localStorage; make any BFF request; expect: refresh POST returns 401, localStorage cleared, query cache empty, navigation to `/login`.
3. **PublicRoute respects stale tokens**. With expired accessToken in localStorage, navigate to `/login`; expect: page renders LoginPage instead of redirecting to dashboard.
4. **Logout button**. Click logout in TopBar; expect: tokens cleared, navigated to `/login`.
5. **CDP regression**: re-run `scripts-tmp/muscle-groups-verify.mjs` — should still pass.
6. **No regression**: full CDP through `Login → /overview/dashboard → /training/muscle-groups` should still pass.

## Risks and mitigations

- **Refresh token rotation**. The `/api/auth/refresh` endpoint returns a NEW refresh token (`auth.service.ts:97` signs both on `generateTokens`). The single-flight refresher stores both via `setTokens`, which is correct on a single-tab browser. **Multi-tab**: if user has two tabs and one refreshes, the other tab's stored refresh token is now stale. We are NOT in scope for cross-tab synchronization (no `BroadcastChannel`); the stale tab will eventually get 401 on its next request and fall through `refresh → 401 → force-logout`, which is acceptable behaviour.
- **Refresh loop**. If `/api/auth/refresh` itself needs auth and returns 401 on a stale refresh token, the single-flight handles it; we just don't retry the original.
- **BFF re-proxied during refresh**. `/api/auth/refresh` goes through the same `[...path]` proxy in BFF, which forwards to `api/auth/refresh`. Verified path during testing: `POST http://localhost:3000/api/auth/refresh` → 200 with `new accessToken` (from initial exploration). No BFF changes needed.
