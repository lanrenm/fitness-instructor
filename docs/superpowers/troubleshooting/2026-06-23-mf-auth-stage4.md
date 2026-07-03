# BFF→Web MF 认证联邦化 · 阶段 4 错误记录

> 日期：2026-06-23
> 范围：`docs/superpowers/specs/2026-06-10-mf-auth-design.md` 实施阶段 4（Web 接入 MF）期间踩到的报错与处理
> 关联：实施规格 / 实施计划 `docs/superpowers/plans/2026-06-10-mf-auth.md`

---

## 一、报错 1：`Cannot read properties of null (reading 'useState')`

### 1.1 现象

浏览器访问 `http://localhost:5173/login` 加载到 `AuthPage` 时崩溃：

```
Unexpected Application Error!
Cannot read properties of null (reading 'useState')
TypeError: Cannot read properties of null (reading 'useState')
    at exports.useState (http://localhost:3000/mf-auth/vendors-node_modules_pnpm_react_19_2_6_node_modules_react_index_js.js:1267:33)
    at AuthPage (http://localhost:3000/mf-auth/__federation_expose_AuthPage.js:901:73)
```

关键线索：`useState` 来自 **`react@19.2.6`** 的 vendor chunk，而不是 BFF 自身的 `react@19.2.4`。

### 1.2 调查路径

| # | 步骤 | 发现 |
|---|---|---|
| 1 | 读设计 spec（`docs/superpowers/specs/2026-06-10-mf-auth-design.md`） | 阶段 4 要求 Web 通过 MF 动态加载 BFF 暴露的 `AuthPage` |
| 2 | `git status` / `pnpm-workspace.yaml` | 工作目录为 `feature/lijm` 分支；workspace 已用 `nodeLinker: hoisted` |
| 3 | `apps/bff/public/mf-auth/` 列出构建产物 | 同时存在 `vendors_..._react_19_2_4_...js` **和** `vendors_..._react_19_2_6_...js` 两个 React vendor chunk（每个 1301 行） |
| 4 | `apps/bff/node_modules/.pnpm/` | pnpm store 同时有 `react@19.2.4` 和 `react@19.2.6` 两个版本 |
| 5 | 读 `apps/bff/package.json` | BFF 声明 `react: 19.2.4` |
| 6 | 读 `apps/web/package.json` | Web 声明 `react: ^19.2.6` |
| 7 | 读 `packages/ui-components/package.json` | **ui-components 把 `react: ^19.2.6` 放在 `dependencies`（应为 peerDependencies）** |
| 8 | `apps/bff/node_modules/.pnpm/@fitness+ui-components@file+.../node_modules/react` | 该 symlink 指向 `react@19.2.6`（ui-components 自带的 react 实例） |
| 9 | `__federation_expose_AuthPage.js:901` | `useState` 通过 `__webpack_require__("webpack/sharing/consume/default/react/react?2c09")` 调用 |
| 10 | 错误栈帧 | 实际运行时命中 `vendors_..._react_19_2_6_...js` 的 `useState`，dispatcher 为 null |

### 1.3 根因

`packages/ui-components` 把 `react` 写在 `dependencies` 而不是 `peerDependencies`：

```json
// 修改前
"dependencies": {
  "@radix-ui/react-slot": "^1.2.4",
  "react": "^19.2.6",          // ← UI 库不应打包 React
  ...
}
```

后果链：

```
ui-components 的 dependencies.react@^19.2.6
  → pnpm 在 apps/bff/.pnpm 多装一份 react@19.2.6
  → apps/bff/node_modules/@fitness/ui-components/node_modules/react → 19.2.6
  → Rspack 把 ui-components（eager:true 共享）整体打入远端 bundle
  → Rspack 在 vendor chunk 同时打出 react@19.2.4（BFF 直接依赖）和 react@19.2.6（ui-components 拖入）
  → MF share scope 注册两份 react，host 的 react@19.2.6 dispatcher 与远端使用的 react@19.2.6 不是同一实例
  → 远端的 useState 走到的是「自己的 React」，dispatcher.current === null
  → "Cannot read properties of null (reading 'useState')"
```

### 1.4 修复

`packages/ui-components/package.json`：把 `react` 从 `dependencies` 移到 `peerDependencies`，并补上 `react-dom`：

```json
// 修改后
"dependencies": {
  "@radix-ui/react-slot": "^1.2.4",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.0",
  "lucide-react": "^0.300.0",
  "tailwind-merge": "^2.2.0",
  "tailwindcss-animate": "^1.0.7"
},
"peerDependencies": {
  "react": "^19.2.6",
  "react-dom": "^19.2.6"
},
```

### 1.5 验证

| 验证项 | 修复前 | 修复后 |
|---|---|---|
| `public/mf-auth/vendors_..._react_19_2_4_...js` | 1301 行（与 19.2.6 共存） | 不再生成 |
| `public/mf-auth/vendors_..._react_19_2_6_...js` | 1301 行 | **不再生成** |
| `public/mf-auth/remoteEntry.js` | 9473 行 | 136KB（主要剩 MF runtime + jsx helpers） |
| `apps/bff/node_modules/.pnpm/@fitness+ui-components@.../node_modules/react` | → `react@19.2.6` | → `react@19.2.4` |
| `pnpm install` 报 `unmet peer react@^19.2.6: found 19.2.4` | — | 提示（warning，不阻断）；后续可统一 React 版本号 |

`rspack build` 输出：

```
WARNING in ⚠ asset size limit: 879.js (602.559 KiB)  // lucide-react 图标全集，与本次修复无关
Rspack compiled with 1 warning in 4.52 s
```

---

## 二、报错 2：根目录残留 `.pnpm-store/`（624MB，无引用）

### 2.1 现象

`git status` 显示 `?? .pnpm-store/`，目录大小 624MB。

### 2.2 调查

| 项 | 结果 |
|---|---|
| 创建时间 | `6月 16 11:46`，本会话日期 `6月 23`，时间对不上 → 非本会话创建 |
| `pnpm config get store-dir` | `undefined`（用默认位置 `~/.pnpm-store`） |
| `.npmrc` | 无 `store-dir` 设置 |
| `apps/bff/.gitignore:7` | `.pnpm-store/*`（BFF 子目录旧规约） |
| 根 `.gitignore` | **没有** `.pnpm-store` |

### 2.3 处理

1. `rm -rf .pnpm-store/`
2. 在根 `.gitignore` 的 Node 段落补上：
   ```
   # 本地 pnpm 缓存目录（避免被误提交；store-dir 未配置时不使用）
   .pnpm-store/
   ```

---

## 三、本次踩坑清单

### 3.1 pnpm + hoisted nodeLinker + file: 链接的同步陷阱

- **现象：** 编辑 `packages/ui-components/package.json` 后，`pnpm install` 不会刷新 `.pnpm/@fitness+ui-components@.../node_modules/@fitness/ui-components/package.json`（pnpm install 时复制的快照，未跟着源文件 inode 走）
- **代价：** 我一开始以为 `pnpm install` 会自动同步，浪费一次 build 才发现 nested `node_modules/react` 还是指向 `react@19.2.6`
- **正确做法：** 改完 source `package.json` 后，要么手动 rm 对应的 `.pnpm/@fitness+...` 目录再 install，要么用 `pnpm install --no-frozen-lockfile` 从子 app 目录触发

### 3.2 `pnpm install --force` 的副作用

- **现象：** 第一次用 `--force` 想强制重建，结果把整个 `apps/bff/node_modules/.pnpm/` 清空（只剩顶层 hoisted 的 6 个 deps），UI-components 符号链接断掉
- **恢复：** 在 apps/bff 子目录再 `pnpm install --no-frozen-lockfile` 才能恢复 `.pnpm/` 全部 525 个包
- **教训：** `--force` 是重型工具，hoisted 模式下尤其要慎用；优先局部删除 `.pnpm/@fitness+...` 子目录

### 3.3 pnpm 报错 `ENOENT: process.cwd failed`

- **触发条件：** 之前 `cd` 进 apps/bff 执行 install，后来 shell 没回到原目录，下一条命令的 `pnpm install` 在错误 cwd 下启动
- **教训：** 保持绝对路径，不要依赖 cd 后状态

### 3.4 lucide-react 版本号歧义

- `apps/bff/package.json` 用 `lucide-react: ^1.16.0`
- `packages/ui-components/package.json` 用 `lucide-react: ^0.300.0`
- pnpm 解析为两个版本：`lucide-react@1.16.0_react@19.2.4`（BFF 用）和 `lucide-react@0.300.0_react@19.2.6`（ui-components 用）
- 修复后（ui-components 用 peer 之后）`lucide-react@0.300.0` 仍作为 ui-components 的 dep 装上，但 pnpm 把它的 react peer 提升为 `react@19.2.6`（因为 ui-components 现在声明 react@^19.2.6 为 peer，由顶层 hoisted react 满足）
- 留下来的 `unmet peer react@"^16.5.1 || ^17.0.0 || ^18.0.0": found 19.2.6` 是 `lucide-react@0.300.0` 自己不支持 react@19（库版本太老），与本次修复无关，是 ui-components 依赖陈旧的 lucide-react 版本问题
- **后续：** ui-components 应升级 `lucide-react` 到支持 react@19 的版本（≥0.400+），或换图标库

### 3.5 React 版本号差异

- `apps/web` 用 `react: ^19.2.6`，`apps/bff` 用 `react: 19.2.4`，`packages/ui-components` 用 `react: ^19.2.6`
- 修复后 BFF 内只装 `react@19.2.4`，Web 仍用 `react@19.2.6`；MF runtime 会用 host 的 19.2.6（version-first + singleton）
- BFF 内打包的 react@19.2.4 实际上成为 dead code（被 share scope 接管）
- **建议：** 把 `apps/bff/package.json` 的 `react` / `react-dom` 也升到 `^19.2.6`，让两端对齐、避免死代码

### 3.6 `apps/web/Dockerfile` 里已有类似症状的 workaround

- Dockerfile 第 30-48 行的注释明确说：ui-components 的 `exports` map 与 tsup 输出格式不一致（声明 `dist/index.js`，实际产出 `index.mjs`），需要在 Docker build 后手动 copy 一份
- 同样的「source 与 hoisted 不一致」模式正是 3.1 的根因；考虑在 `apps/bff` / workspace 根加一个 `prepare` 脚本，自动同步 `packages/ui-components/dist/` 到 `apps/{bff,web}/node_modules/@fitness/ui-components/dist/`

### 3.7 Rspack `splitChunks` 把 eager 模块切大 vendor

- `@fitness/ui-components: { eager: true }` 让 Rspack 把 ui-components 整个连同依赖一起塞进远端 bundle
- 修复前由于 React 被双装，远端 vendor 有 `react_19_2_4` 和 `react_19_2_6` 两份各 1301 行
- 修复后 vendor 干净，但 `lucide-react@1.16.0` 全部图标被打成单 chunk `879.js` 602 KiB，触发 asset size 警告
- **后续可优化：** 在 `rspack.config.mjs` 加 `splitChunks` 把 lucide-react 按需拆分（treeshake icons），或在 `apps/bff/src/remote/...` 里只显式 import 需要的图标让 tsup 摇树

---

## 四、未触发但潜在的风险

| 项 | 状态 | 后续动作 |
|---|---|---|
| Rspack dev server 不存在导致 `disableDynamicRemoteTypeHints` 关闭 WebSocket | 当前配置已禁用 | 已加 `dev.disableDynamicRemoteTypeHints: true` 两端同步，无需处理 |
| Vite 远端用 global script（无 `type: 'module'`）保证 `import('bff_auth/AuthPage').default` 拿到组件 | 已在 `vite.config.ts` 注释 | 已处理 |
| `localStorage` 不可用（隐私模式）→ 降级内存存储 + 顶部提示 | `useAuth.login` 已返回 `mode` | 已在 LoginPage 实现内存模式提示横幅，无需处理 |
| React 19.2.4 / 19.2.6 在跨 bundle 单例性 | 修复后 host React 19.2.6 单一实例 | 后续统一版本号 |

---

## 五、报错 3（修复 #1 之后）：`Cannot read properties of undefined (reading 'useState')` + `loadShareSync failed` 警告

### 5.1 现象

修复 #1（ui-components 把 react 移到 peerDependencies）之后，错误栈从 `null` 变成 `undefined`：

```
Unexpected Application Error!
Cannot read properties of undefined (reading 'useState')
TypeError: Cannot read properties of undefined (reading 'useState')
    at exports.useState (http://localhost:3000/mf-auth/vendors-...js:?:?)
    at AuthPage (http://localhost:3000/mf-auth/__federation_expose_AuthPage.js:?:?)
```

控制台 console.error（不是 throw，是 installHook.js:1 的 catch handler 打出来的）：

```
loadShareSync failed! The function should not be called unless you set "eager:true".
If you do not set it, and encounter this issue, you can check whether an async boundary is implemented.
The original error message is as follows:
RUNTIME_005: Invalid loadShareSync function call from bundler runtime
```

### 5.2 关键差异（与报错 #1 比）

| 维度 | 报错 #1（修复前） | 报错 #3（修复 #1 之后） |
|---|---|---|
| useState 报错值 | `null` | `undefined` |
| 错误根源 | 远端 vendor chunk 里 React 的 dispatcher.current 是 null（双实例） | 远端通过 share scope 拿 React，但 share scope 里没注册 |
| 控制台 | 无警告 | `loadShareSync failed` + RUNTIME_005/RUNTIME_006 |
| 远端 bundle | `vendors_*_react_19_2_4_*.js` + `vendors_*_react_19_2_6_*.js` 双 vendor chunk 共存 | 仅一份 react vendor chunk（已被 share scope 接管） |

`null` vs `undefined` 是关键线索：拿到 `null` 表示拿到了 React 但 dispatcher 字段为 null（双实例错位），拿到 `undefined` 表示根本没拿到 React（share scope 解析失败）。

### 5.3 调查路径

| # | 步骤 | 发现 |
|---|---|---|
| 1 | `grep -E "shareKey:\"react\"" apps/bff/public/mf-auth/main.js` | `shareKey:"react",import:"react",requiredVersion:"^19.0.0",strictVersion:!1,singleton:!0,eager:!1,fallback:()=>()=>__webpack_require__(564),treeShakingMode:null` |
| 2 | `rspack.config.mjs` `shared.react` 配置 | `eager: false`（默认） |
| 3 | `main.js` 中 `__webpack_require__(564)` | 不在主 bundle 内，是一个独立的 async chunk（`__webpack_require__.e(564)`） |
| 4 | `apps/web/vite.config.ts` `shared.react` 配置 | `eager: true`（手写加的） |
| 5 | 对比两端 eager 配置 | host `eager:true`、remote `eager:false`（默认）—— 不对称 |
| 6 | `node_modules/@module-federation/enhanced/rspack/dist/...` 的 share scope runtime | `loadShareSync()` 在 share 未注册且 `get()` 返回 Promise 时抛 RUNTIME_005；installHook 的 catch handler 打出"should not be called unless eager:true" |
| 7 | AuthPage 编译产物 `__federation_expose_AuthPage.js` 的 chunk loading | chunk 124 用 `r(7635)` 同步 require 共享模块的 consume proxy；consume proxy 内部走 sync path `loadShareSync`，而远端 share scope 此时空着 |

### 5.4 根因

`apps/bff/rspack.config.mjs` 把 `react` / `react-dom` / `lucide-react` 的 `eager` 留默认（`false`）。后果链：

```
远端 shared.react.eager = false
  → Rspack 把 react/react-dom 的 fallback 包成独立 async chunk（__webpack_require__.e(564)）
  → 远端 main.js 的 share scope 注册信息（fallback 函数）指向 async chunk，需要先 await
  → AuthPage 编译出来的代码用同步 require 拉 react 的 consume proxy（webpack/sharing/consume/default/react/react?hash）
  → consume proxy 走 installInitialConsumes 流程，调用 loadShareSync("react")
  → loadShareSync 看 share scope：注册信息存在但 lib/get 都是 async chunk load 的产物（Promise），同步路径拿到 Promise 不是 module
  → RUNTIME_005: Invalid loadShareSync function call from bundler runtime
  → installHook 的 catch handler 打出"loadShareSync failed! ...should not be called unless you set 'eager:true'"
  → consume proxy 返回 undefined
  → AuthPage 的 React 是 undefined → React.useState → "Cannot read properties of undefined"
```

`loadShareSync` 这个名字本身就是关键字：MF runtime 的契约是**只有当 share 是 eager 注册（同步）的时候才能调同步版本**，否则必须用 async 版本（`loadShare`）。报错信息第一句"should not be called unless you set 'eager:true'"是 runtime 的早期断言。

### 5.5 修复

`apps/bff/rspack.config.mjs`：把远端 react/react-dom/lucide-react 的 eager 都显式设成 true，跟 host 对齐：

```js
// 修改前
shared: {
  react: { singleton: true, requiredVersion: '^19.0.0', eager: false },
  'react-dom': { singleton: true, requiredVersion: '^19.0.0', eager: false },
  'lucide-react': { singleton: true, eager: false },
  '@fitness/ui-components': { singleton: true, eager: true },
}

// 修改后
shared: {
  react: { singleton: true, requiredVersion: '^19.0.0', eager: true },
  'react-dom': { singleton: true, requiredVersion: '^19.0.0', eager: true },
  'lucide-react': { singleton: true, eager: true },
  '@fitness/ui-components': { singleton: true, eager: true },
}
```

注释里说明为什么远端也要 eager:true（因为 AuthPage 用的是同步 require，不能靠 async fallback 救）。

### 5.6 验证

| 验证项 | 修复前 | 修复后 |
|---|---|---|
| `main.js` 中 react 的 share scope | `eager:!1,fallback:()=>()=>__webpack_require__(564)`（async chunk 564） | `eager:!0,fallback:()=>()=>__webpack_require__(9471)`（module 9471 是 react 本体，inline） |
| `__webpack_require__.e(N)` 调用次数 | >0（async chunk 加载） | **0**（全部 inline） |
| main.js 体积 | 157 KiB（react 在 chunk 564） | 760 KiB（react inline；eager 副作用） |
| module 9471（react fallback） | — | `9471(e,a,t){"use strict";e.exports=t(4860)}`（module 4860 是 `Symbol.for("react.transitional.element")...` React 本体） |
| remoteEntry.js 行数 | — | 6 行（MF runtime bootstrap） |
| AuthPage 渲染 | `Cannot read properties of undefined (reading 'useState')` | **待运行时验证** |

### 5.7 为什么 `eager: true` 不导致 React 双实例

eager:true 不是"远端把 React 打进自己的 bundle 单独用"，而是"远端把 React 作为 fallback 同步注册进 share scope"。运行时只有一份 React 胜出：singleton + version-first 取最高版本。apps/web 有 19.2.6、apps/bff 有 19.2.4，share scope 选 19.2.6（host 的版本），host 和 remote 共用这一份。

### 5.8 反方案：把 react/react-dom 从 shared 里删掉（用户曾提议）

把 `apps/bff/rspack.config.mjs` `shared` 里 react/react-dom 注释掉，会重新踩回报错 #1：

- host 自带 react@19.2.6
- remote 自带 react@19.2.4
- 浏览器页面里**两份 React 实例并存**，dispatcher 互相隔离
- host 的 `createRoot().render(<AuthPage />)` 用 host 的 React reconciler 创建 fiber 树，AuthPage 内部 `useState()` 走 remote 的 React 19.2.4 → dispatcher.current 不是 host 那个 → 回到 `null` 而不是 `undefined`

所以**保持 `eager: true`、不要注释掉 shared**。

---

## 六、报错 4（修复 #1 + #2 之后）：`Cannot read properties of null (reading 'useState')` 回到 null

### 6.1 现象

报错 #3（undefined + loadShareSync 警告）修复后，再次访问 `/login`，错误回到 `null` 而不是 `undefined`：

```
TypeError: Cannot read properties of null (reading 'useState')
    at a.useState (http://localhost:3000/mf-auth/remoteEntry.js:1:7688)
    at Z (http://localhost:3000/mf-auth/__federation_expose_AuthPage.js:511:16858)
    at Object.react_stack_bottom_frame (http://172.30.0.202:5173/node_modules/.vite/deps/react-dom_client.js?v=b746bb63:12868:12)
    at renderWithHooks (.../react-dom_client.js?v=b746bb63:4213:19)
    at updateFunctionComponent (.../react-dom_client.js?v=b746bb63:5569:16)
    ...
```

`remoteEntry.js:1:7688` 附近：
```js
a.useState=function(e){return I.H.useState(e)}, a.version="19.2.4"
```

`a` 是远端 Rspack 在 main.js 里 inline 的 React 19.2.4，`I.H` 是 `ReactSharedInternals.ReactCurrentDispatcher`。错误位置是 `null.useState`，即 `I.H.current === null`。

### 6.2 关键线索

| 维度 | 报错 #1（peer-dep 修复前） | 报错 #4（plan A 修复前） |
|---|---|---|
| 报错 React 来源 | `vendors_*_react_19_2_6_*.js`（双装，react 19.2.6 dispatcher null） | `remoteEntry.js` 里 inline 的 `a`（远端 React 19.2.4 dispatcher null） |
| useState 报错值 | `null` | `null` |
| host reconciler | host 的 React 19.2.6 | host 的 `react-dom_client.js?v=b746bb63`（Vite prebundled 19.2.6） |
| 控制台警告 | 无 | 无（跟 #3 的 loadShareSync 警告不一样） |

跟 #1 表面相同（都是 null），但根因不同：#1 是 Rspack 双 vendor chunk 把 react 19.2.4 + 19.2.6 都打进远端 bundle；#4 是 share scope 拿错了实例，host 的 React 19.2.6 dispatcher 在 host 自己的 `ReactSharedInternals` 上，远端 inline 的 React 19.2.4 自己的 `ReactSharedInternals.ReactCurrentDispatcher.current` 没人设过。

### 6.3 根因

`apps/web/vite.config.ts` 的 `shared` 没有 `import: false`，Vite 插件不生成 seed code。后果链：

```
Vite dev 启动，HTML 入口代理执行 initHost()
  → 远端 remoteEntry.js 已加载（<script> 标签）
  → 远端 runtime.init() 把远端 initializeSharingData 同步进 __mfModuleCache.share
     - __mfModuleCache.share["react"] = 远端 React 19.2.4（initializeSharingData 的 eager:1 fallback）
  → initHost 循环 usedShared（react/react-dom/lucide-react/ui-components）
     - 检查 __mfModuleCache.share["react"] !== undefined → 不是，跳过 loadShare
  → 远端 main.js 的 AuthPage 通过 consume proxy（webpack/sharing/consume/default/react/react?hash）取 react
     - 拿到 share scope 里的远端 React 19.2.4
  → host 的 createRoot(...).render(<AuthPage />) 用 host 自己的 React-DOM 19.2.6 (Vite prebundled)
     - 设置 ReactSharedInternals.ReactCurrentDispatcher.current（host 自己的 React 19.2.6 的 internals）
  → AuthPage 调 React.useState，是远端 React 19.2.4 的 useState
     - 访问远端 React 19.2.4 的 ReactSharedInternals.ReactCurrentDispatcher.current
     - 这个 current 没人设过 → null
     - null.useState → 抛错
```

总结：**host 的 reconciler（19.2.6）设的 dispatcher 在 host 自己的 internals 上，AuthPage 拿的是 share scope 里的远端 React 19.2.4，有自己独立的 internals，从来没人设过 dispatcher.current → null**。

### 6.4 修复（Plan A）：host 端 `shared` 加 `import: false`

`apps/web/vite.config.ts`：

```ts
shared: {
  react: { singleton: true, requiredVersion: '^19.0.0', eager: true, import: false },
  'react-dom': { singleton: true, requiredVersion: '^19.0.0', eager: true, import: false },
  'lucide-react': { singleton: true },
  '@fitness/ui-components': { singleton: true },
}
```

### 6.5 修复原理

`import: false` 让 Vite 插件的 `generateHostAutoInitSharedCacheSeedCode(command="serve")` 不再返回空字符串。它对每个 `shareConfig.import === false` 的模块生成 seed 代码，注入到 `initHost` 顶部、loadShare 循环之前：

```js
// dev 模式生成、build 模式不生成（line 58148: if (command === "build") return "";）
if (__mfModuleCache.share["react"] === undefined) {
  const mod = await import("/@fs/<host>/node_modules/react/index.js");
  // __mfNormalizeRuntimeShare 包一层
  __mfModuleCache.share["react"] = mod;
}
if (__mfModuleCache.share["react-dom"] === undefined) {
  const mod = await import("/@fs/<host>/node_modules/react-dom/client.js");
  __mfModuleCache.share["react-dom"] = mod;
}
```

seed 跑完后，`__mfModuleCache.share["react"] = host 的 React 19.2.6`。后续 initHost 循环 `if (... !== undefined) continue;` 直接跳过 loadShare。

配合 `proxyPreBuildShared:resolve-shared-loadShare` 插件（host 端 `useDirectReactImport = false`），host 自己的 `import 'react'` 也会被重写到 `virtual:mf:loadShare/react`，从 share scope 拿。

最终：
- seed：把 host 的 React 19.2.6 写进 `__mfModuleCache.share["react"]`
- host 的 host code（LoginPage 等）`import 'react'`：走 proxy，从 share scope 拿 host 的 React 19.2.6
- 远端 AuthPage 的 consume proxy：从 share scope 拿 host 的 React 19.2.6
- 三者引用同一份 module，`ReactSharedInternals` 同一份对象
- host 的 reconciler（19.2.6）设的 dispatcher.current 在这一份 internals 上，AuthPage 的 useState 访问同一个 internals → 有 dispatcher → 不抛错

### 6.6 为什么 lucide-react / @fitness/ui-components 不加 `import: false`

`grep -r "from ['\"]lucide-react\|from ['\"]@fitness" apps/web/src` 在 host 代码里查不到这两个 import。host 端没用到这两个包，proxy 不会拦截 `import` 它们，远端 AuthPage 的 consume proxy 走 share scope，远端 initializeSharingData 的 fallback 注册远端版本即可。

### 6.7 已知限制：dev 模式有效，build 模式不生成 seed

`generateHostAutoInitSharedCacheSeedCode(command = "build")` 永远返回空串。意味着 `vite build` 模式（生产构建）下，share scope 仍然只会被远端 fallback 占位，host 的 `import 'react'` 通过 proxy 拿到的是远端 React 19.2.4，dispatcher 还是会错位。

**生产构建需要另想办法**，候选：
- 在 apps/web 入口加一个 `<script>` 标签或一段自写 module，先 `import('react').then(m => globalThis.__mfModuleCache.share['react'] = m)`，再让 Vite 插件跑
- 把 React 从 shared 里完全删，让 host 自带 Vite 自己的预构建 React，并接受远端 inline 自己的 React（两份实例 + 双方 dispatcher 错位）
- 在 apps/bff `rspack.config.mjs` 把 `shared.react` 删掉，让远端 main.js 不再注册 React 到 share scope，迫使远端 AuthPage 直接 require 远端自己的 React module 4860（不经 share scope），这样 host 的 `import 'react'` 走 share scope 拿自己的 React 19.2.6，远端自己 inline 19.2.4，两边互不干扰；缺点是 dispatcher 还是双实例，但 host 的 dispatcher 设的是 host 自己的 React，远端 AuthPage 的 dispatcher 没人设——又回到 null。

需要更深入讨论再开 issue。当前 dev 模式先跑通再说。

### 6.8 验证步骤

1. `apps/web/vite.config.ts` 改完后**必须重启 Vite dev**（HMR 不会重新生成 host auto-init 模块）
2. 浏览器强制刷新（Cmd+Shift+R）打开 `http://localhost:5173/login`
3. DevTools 控制台输入 `__mfModuleCache.share`，回车查看：
   - `share.react` 应该是 host 自己的 React 19.2.6（`Object.getPrototypeOf` 链上有 `version === "19.2.6"`）
   - `share["react-dom"]` 同理
4. 页面应该正常显示 AuthPage（登录表单），不报 useState 错
5. 如果还有错，把 DevTools 里 `__mfModuleCache.share` 的 dump 贴出来

---

## 七、本次踩坑清单（累计）

### 3.8 远端 eager:false 跟 host eager:true 的不对称是隐性陷阱

- **现象：** host 端 `vite.config.ts` 显式设 `react: { ..., eager: true }`，远端 `rspack.config.mjs` 用默认 `eager: false`，看起来「host eager 够用了」
- **陷阱：** MF runtime 的同步/异步契约是按**远端 consume 时的 share scope 状态**判断的。远端 share 的 fallback 走 async chunk → consume proxy 的同步路径拿到 Promise → loadShareSync 抛错
- **正确做法：** host 和 remote 的 shared 配置**逐项对齐**（包括 eager），不要假设某一端的 eager 能救另一端

### 3.9 `null` vs `undefined` 区分 useState 报错根源

- `null`：拿到 React 但 dispatcher 错位（**双 React 实例**，阶段 4 第 1 个坑）
- `undefined`：没拿到 React（**share scope 解析失败**，阶段 4 第 2 个坑）
- 下次看到 useState 报错先看是 null 还是 undefined，再去查 share scope 配置

### 3.10 `loadShareSync` 警告的语义

- 字面意思是"runtime 提醒你应该用 `loadShare`（async）而不是 `loadShareSync`"
- 触发条件 = share scope 是异步注册 + 有同步路径调用 loadShareSync
- 修复方向不是改调用方（那是 Rspack 编译产物没法改），而是改 share scope 的 `eager: true` 让同步路径合法

### 3.11 `__webpack_require__.e(N)` 调用数 = async chunk 加载次数

- 验证 eager:true 是否生效的最简单办法：`grep "__webpack_require__\.e" build/main.js | wc -l`
- eager:true 应该让这个数字降到 0（或者只保留动态 import 的 chunk，比如 `__federation_expose_AuthPage.js` 自己）