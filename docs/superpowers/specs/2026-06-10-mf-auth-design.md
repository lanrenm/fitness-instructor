# BFF → Web 认证模块联邦化设计

> 日期：2026-06-10
> 状态：待用户审阅
> 范围：将 Web 端登录/注册从"跳转 BFF 完整页面"改为"Web 通过 Module Federation 动态加载 BFF 暴露的 AuthPage 组件"

## 一、背景与目标

### 1.1 当前架构

- `apps/web`（Vite + React 19 + React Router 7，SPA）`/login` 路由通过 `window.location.href` 跳转到 BFF
- `apps/bff`（Next.js 16 App Router）`/auth` 路由 SSR 渲染完整的登录/注册页
- 登录成功后 BFF 写 `localStorage` 并 `router.push('/')`
- 缺点：整页跳转、跨端口丢失 Web SPA 状态、BFF 必须提供 SSR 页面、部署耦合

### 1.2 目标

- Web 通过 Module Federation 动态加载 BFF 暴露的 `AuthPage` React 组件
- 整页登录页改为 SPA 内部组件加载，无浏览器导航
- BFF 移除 `/auth` 路由，仅保留 API + MF 远端资源托管
- 登录成功后的 token 存储与跳转由 Web 决定，AuthPage 通过 `onSuccess` 回调解耦

## 二、架构

```
┌────────────────────────────────────────────────────────────┐
│ apps/web (Vite, Host)                                      │
│  Vite + @module-federation/vite                            │
│   shared: react, react-dom, @fitness/ui-components,        │
│           lucide-react                                     │
│   通过 dynamic import 加载远端                              │
│       "bff_auth/AuthPage"                                  │
│       http://localhost:3000/mf-auth/remoteEntry.js         │
└───────┬────────────────────────────────────────────────────┘
        │ fetch /api/auth/* (Vite proxy /bff → :3000)
┌───────┴────────────────────────────────────────────────────┐
│ apps/bff :3000                                             │
│ ┌─────────────────────────────┐  ┌──────────────────────┐  │
│ │ Next.js (保留, 减负)         │  │ Rspack 构建 (新增)    │  │
│ │  /api/auth/login            │  │  public/mf-auth/     │  │
│ │  /api/auth/register         │  │   remoteEntry.js     │  │
│ │  /api/[...path] 代理        │  │   src_AuthPage_*.js  │  │
│ │  + 静态托管 public/mf-auth/ │  │   shared-chunk.js    │  │
│ │                             │  │  入口: AuthPage 组件 │  │
│ │  /auth 路由 ✗ 删除           │  │  shared: react ...  │  │
│ └─────────────────────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**关键决策：**
- BFF 拆为 Next.js（API）+ Rspack 单独打的 MF 远端，共享同一份 `apps/bff/src/` 下 AuthPage 源码
- 依赖通过 MF `shared` 强制 singleton，避免 "Invalid Hook Call"
- 表单 API 通信路径不变（`/api/auth/*` 走 Vite proxy）
- 认证成功后的 token 处理 + 跳转由 Web 决定

## 三、模块边界与文件变更

### 3.1 BFF 侧

| 类型 | 路径 | 说明 |
|---|---|---|
| 新建 | `apps/bff/rspack.config.mjs` | Rspack 配置，输出 MF remote bundle 到 `apps/bff/public/mf-auth/` |
| 新建 | `apps/bff/src/remote/bootstrap.ts` | remote 入口：`export { default as AuthPage } from './app/(auth)/auth/_components/AuthPage'` |
| 新建 | `apps/bff/src/app/(auth)/auth/_components/AuthPage/index.tsx` | 从原 `page.tsx` 抽出的顶层 AuthPage React 组件 |
| 新建 | `apps/bff/src/app/(auth)/auth/_components/AuthPage/index.module.css` | 接管原 `auth.module.css` 中容器/卡片/标题/底部样式 |
| 删除 | `apps/bff/src/app/(auth)/auth/page.tsx` | 整个 `(auth)/auth` 路由删除 |
| 删除 | `apps/bff/src/app/(auth)/auth/auth.module.css` | 样式已迁出 |
| 修改 | `apps/bff/next.config.ts` | 移除 `(auth)` 路由；给 `/mf-auth/*` 加 CORS headers |
| 修改 | `apps/bff/package.json` | 新增 `dev:remote`（rspack watch）、`build:remote`；依赖 `@module-federation/enhanced`、`@rspack/core`、`@rspack/cli` |
| 保留 | `_components/BrandingSection/`、`LoginForm/`、`RegisterForm/`、`_hooks/useAuthMode.ts` | 不动，被 AuthPage 引用 |

### 3.2 Web 侧

| 类型 | 路径 | 说明 |
|---|---|---|
| 修改 | `apps/web/vite.config.ts` | 加 `@module-federation/vite` 插件，声明 host + 共享依赖；远端 URL 读 `VITE_MF_REMOTE_URL` env |
| 修改 | `apps/web/package.json` | 加 `@module-federation/enhanced`、`@module-federation/vite` |
| 修改 | `apps/web/src/pages/Login/index.tsx` | 替换 `window.location.href` 为 dynamic import + `<AuthPage onSuccess={...} />`；加加载失败兜底 |
| 修改 | `apps/web/src/routes/` | `/login` 路由仍指向该组件（路由表本身不变） |

### 3.3 共享依赖（MF `shared` 强制 singleton）

| 模块 | Web (host) | BFF (remote) | 策略 |
|---|---|---|---|
| `react` | 19.2.6 | 19.2.4 | 强制 singleton（取 host 版本） |
| `react-dom` | 19.2.6 | 19.2.4 | 强制 singleton |
| `react-router-dom` | 7.x | — | 仅 host 用 |
| `@fitness/ui-components` | 共享 | 共享 | 强制 singleton（路径别名必须两边一致） |
| `lucide-react` | 共享 | 共享 | 强制 singleton |

### 3.4 关键决策说明

**为什么 Rspack 输出到 `apps/bff/public/mf-auth/`：** Next.js 默认把 `public/*` 暴露为 `/`，省去 rewrite/static 路由配置。

**为什么不让 Rspack 起独立 dev server：** 多一个端口要 proxy，且源码热更新要重新走 Next.js；写 public 让 Next.js 服务更省心。

## 四、运行时数据流

```
Web (:5173)                                              BFF (:3000)
──────────                                              ──────────
1. /login 路由渲染 <LoginPage />
2. useEffect → import('bff_auth/AuthPage')
3. MF runtime 拉取入口 ────────────────────────────────→ GET /mf-auth/remoteEntry.js
4. ←───────────────────────────── remoteEntry.js + 共享依赖元信息
5. MF runtime 拉取 AuthPage chunk ─────────────────────→ GET /mf-auth/src_AuthPage_*.js
6. ←───────────────────────────── AuthPage 模块代码
7. <AuthPage onSuccess={handleAuthSuccess} /> 渲染
8. 用户提交表单
9. fetch('/api/auth/login', {POST, body})
   ↓ Vite proxy /bff → :3000
10. ────────────────────────────────────────────────→ /api/auth/login
11. ←──────────────────────── { accessToken, refreshToken }
12. AuthPage 调 onSuccess({accessToken, refreshToken})
13. Web 写 localStorage，navigate('/')
14. React Router 切到 Home 路由
```

**关键点：**
- 步骤 3/5 跨域（CORS 必需）；步骤 9 走 Vite proxy 不跨域
- AuthPage 只暴露 `onSuccess`，不直接操作 Web 的路由或 storage
- 跨 bundle 的 `localStorage` 共享同源即可（本设计同源部署）

## 五、Dev 体验

| 进程 | 命令 | 端口 | 监听 |
|---|---|---|---|
| BFF Next.js | `next dev` | 3000 | `apps/bff/src/**`、`apps/bff/next.config.ts` |
| BFF Rspack | `rspack watch` | — | AuthPage 相关文件，输出到 `apps/bff/public/mf-auth/` |
| Web Vite | `vite` | 5173 | `apps/web/src/**`、远端配置 |

**启动方式：** `apps/bff/package.json` 加 `"dev": "pnpm -m dev"` 并行跑 Next + Rspack（用 `concurrently`）；根目录 `pnpm -r --parallel -m dev` 保持不变。

**HMR 行为：**
- 改 Web 源码：Vite HMR 生效，无需刷新
- 改 remote（AuthPage 及子组件）：Rspack watch 重写 `public/mf-auth/`，**Web 需硬刷新**（MF remote 替换不走 Vite HMR，固有约束）

**CORS（`next.config.ts`）：**
```ts
async headers() {
  return [{
    source: '/mf-auth/:path*',
    headers: [{
      key: 'Access-Control-Allow-Origin',
      value: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    }],
  }];
}
```

**Vite proxy 保留：** `/bff` 和 `/users` 不动；表单 fetch 的 `/api/auth/*` 仍走 proxy。

## 六、生产部署

| 应用 | 构建产物 | 部署目标 |
|---|---|---|
| BFF | `.next/` + `public/mf-auth/`（Rspack 输出） | Next.js 容器/CDN（mf-auth/ 走静态托管） |
| Web | `dist/` | 静态 CDN |

**构建顺序（`apps/bff/package.json`）：**
```json
"build": "pnpm build:remote && next build",
"build:remote": "rspack build"
```

Rspack 先打 remote，Next.js 构建时 `public/mf-auth/` 已就位；Next.js 把整个 `public/` 拷贝到输出。

**MF 远端 URL 配置化（`apps/web/vite.config.ts`）：**
```ts
mfRemoteUrl: process.env.VITE_MF_REMOTE_URL
            ?? 'http://localhost:3000/mf-auth/remoteEntry.js'
```

生产改 env（`https://bff.example.com/mf-auth/remoteEntry.js`）。

## 七、错误处理

| 场景 | 处理 |
|---|---|
| MF 远端加载失败（网络/CORS） | `LoginPage` catch → "加载失败，点击重试" + 重新 dynamic import |
| AuthPage 内部错误 | 沿用现有表单 `setError` 路径 |
| `localStorage` 不可用（隐私模式） | `handleAuthSuccess` 包 try/catch；失败时降级内存存储 + 提示 |
| 共享依赖版本不匹配 | MF `shared` 配 `requiredVersion` + `strictVersion: true` |

## 八、验收标准

| 项 | 验证方法 |
|---|---|
| 所有包能构建 | `pnpm -r build` 退出码 0 |
| MF 远端可达 | `curl http://localhost:3000/mf-auth/remoteEntry.js` 返回 JS（200 + CORS 头） |
| Web 端到端 | 浏览器访问 `http://localhost:5173/login`，提交测试账号，跳到 `http://localhost:5173/`，`localStorage` 有 `accessToken` |
| BFF `/auth` 已移除 | `curl http://localhost:3000/auth` 返回 404 |
| 切换模式 | 在 `/login` 切换登录/注册，动画与原版一致 |
| 错误路径 | 故意输错密码 → 表单显示错误，按钮变回可点 |
| 跨 bundle 单例 | React DevTools 中 react / @fitness/ui-components 只有一个实例 |

## 九、实施阶段

**阶段 1：纯重构（不上 MF）**
- 抽 `AuthPage` 组件到 `_components/AuthPage/`
- BFF `/auth` 路由改为 `import { AuthPage } from './_components/AuthPage'`
- 验证 BFF `/auth` 行为与现状一致
- 风险：零；可独立合并

**阶段 2：BFF 加 Rspack 远端构建**
- 装 `@rspack/core` `@rspack/cli` `@module-federation/enhanced`
- 加 `rspack.config.mjs`，入口 `src/remote/bootstrap.ts`
- 加 `dev:remote` / `build:remote` 脚本
- 验证：`rspack build` 输出 `public/mf-auth/remoteEntry.js`

**阶段 3：BFF 加 CORS + 静态托管**
- `next.config.ts` 加 `/mf-auth/:path*` 的 CORS headers
- 删除 BFF `(auth)` 路由 + `auth.module.css`
- 验证 `curl -I http://localhost:3000/mf-auth/remoteEntry.js` 见 `Access-Control-Allow-Origin`

**阶段 4：Web 接入 MF（关键一步）**
- 装 `@module-federation/vite` `@module-federation/enhanced`
- `vite.config.ts` 加 plugin，声明 host + 共享
- `LoginPage/index.tsx` 改为 dynamic import + `<AuthPage onSuccess={...} />`
- Web `handleAuthSuccess` 写 localStorage + `navigate('/')`
- 端到端验证

**阶段 5：清理（可选）**
- 文档、README 更新
- 删 BFF 端 `apps/bff/src/app/(auth)/` 整个目录

## 十、风险登记表

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| 1 | Rspack 与 Next.js 对 `tsconfig` 路径别名解析不一致 | 中 | `rspack.config.mjs` 显式声明 `resolve.alias`，与 BFF `tsconfig.json` 的 `paths` 一致 |
| 2 | React 版本错位（BFF 19.2.4 vs Web 19.2.6） | 低 | MF singleton 取 host 版本；后续统一升级 |
| 3 | `@module-federation/enhanced` Vite/Rspack 双端协议版本错配 | 中 | 两端锁同一版本；dev 冒烟验 |
| 4 | remote 改动 HMR 失效，需硬刷新 | 低 | 已知约束，开发规范文档化 |
| 5 | 跨域拉 remoteEntry 失败但页面没兜底 | 中 | 阶段 4 必须加 `import()` 失败 catch + 重试按钮 |
| 6 | production 中 Next.js 不托管 `public/mf-auth/`（CDN 漏配） | 低 | 阶段 2 收尾加 prod 部署文档；CI `next start` 后 `curl` 验证 |
| 7 | `@fitness/ui-components` 两端版本不同导致 API 不一致 | 中 | MF shared 配 `requiredVersion`；升级时统一 |
| 8 | `lucide-react` 共享后 icon tree-shaking 差异 | 低 | 短期可接受；后续可改各自打包 |

## 十一、回滚策略

- **阶段 1-2 之间：** 阶段 1 自身就是无 MF 重构，独立可回滚
- **阶段 3 之后：** BFF 仍可保留 `auth.module.css` + `(auth)` 路由作为 fallback；通过 env 切换（不推荐长期保留，仅紧急回滚用）
- **阶段 4 之后：** Web 切回老 redirect 只需把 `LoginPage` 改回 `window.location.href`；BFF 恢复 `(auth)` 路由。两侧改动量小，可快速回滚
