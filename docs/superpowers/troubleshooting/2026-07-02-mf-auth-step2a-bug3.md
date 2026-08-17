# 2026-07-02 — Step 2a Bug3: Shadow DOM bundle 渲染无样式

## 现象
Step 2a（Shadow DOM + React bundle 注入）从 BFF `rspack.embed.config.mjs` 产出的 `embed.js` 加载到 host 后，React 树能正常 mount 出来，文本内容（BrandingSection + LoginForm 中文）也渲染了，但**所有元素 `class=""` 为空字符串**，flex 居中、卡片背景、橙色品牌区全部丢失。

## 根因
`style-loader@4` 的 `lazyStyleTag` 模式下，CSS module 的 default export 形状是：

```js
{ use, unuse, locals }
```

className 映射在 `.locals` 子对象上（由内层 css-loader 写入）。`import styles from './index.module.css'` 拿到的是顶层 runtime，`styles.container` 是 undefined。**bundle 里的 CSS 规则是好的，是 React 树渲染时 className 落空。**

CDP 验证：
```json
{
  "containerFound": false,    // 找不到 [class*="container"]，因为元素 class 是空
  "shadowStyleCount": 5,      // 5 个 <style> 都在 shadow root
  "headAuthStyleCount": 0     // bundle 的 CSS 都成功搬进 shadow root 了
}
```

为什么之前没暴露：`@apply` 没被解析的旧版本（pre-2026-07-02），`.container` 规则是 `display: ...` 缺失，className 即便填了对也不可见。修了 `@apply`（加了 postcss-loader）后才暴露这个 className 落空。

## 修复
4 个 auth 组件文件（AuthPage/BrandingSection/LoginForm/RegisterForm）的 CSS module 导入改成兼容两种打包器的形式：

```ts
import _styles from './index.module.css';
const styles = _styles.locals ?? _styles;
```

- Rspack + style-loader v4（embed bundle）：`_styles.locals` 存在 → `styles = {container, card, ...}` ✓
- Turbopack（BFF 的 Next.js dev SSR）：`_styles` 本身就是 locals → `?? _styles` 兜底 ✓

`embed-mount.tsx` 保持不变，因为它需要 `.use()` 来做 lazy 注入，所以读的是顶层 runtime。

## 衍生配置改动（同一个根因链路上的前置修复）
1. **`rspack.embed.config.mjs` loader 顺序**：从 `[style, postcss, css]` 改成 `[style, css, postcss]`。Rspack 的 `use` 数组右到左应用：postcss-loader 要最先吃到 raw CSS，把 `@apply flex items-center` 展开成 `display: flex; align-items: center; ...`；然后 css-loader 再做 CSS Modules 哈希；最后 style-loader 用 `lazyStyleTag` 包装。顺序反了 css-loader 会先把 CSS 变成 `// Imports` 注释开头的 JS module，postcss-loader 收到 JS 直接报 `Unknown word //`。

2. **`apps/bff/Dockerfile` pnpm 11 修复**：
   ```dockerfile
   RUN echo "node-linker=hoisted" > .npmrc
   ENV CI=true
   RUN pnpm install --ignore-scripts --no-frozen-lockfile
   ```
   pnpm 11 在非 TTY 环境默认拒绝 purge modules dir，需要 `CI=true`；加 `postcss-loader` 后 lockfile 过期需要 `--no-frozen-lockfile`。

3. **清掉旧的 `docker_bff-node-modules` named volume**：image 升级后老的 named volume 里没有 `postcss-loader`，但 `cp -rn`（no-clobber）不会覆盖旧文件，结果 embed 编译时拿到部分旧部分新的 .bin/ → `concurrently` 找不到 next/rspack 入口无限重启。`docker volume rm docker_bff-node-modules` + `docker compose up -d bff` 重建。

4. **Turbopack stale cache**：重启后 Turbopack 报 `Expected '</', got '<eof>'` 在 LoginForm 95 行，但磁盘文件是完整的 100 行。`docker exec fi-bff rm -rf /app/.next/cache` + `docker compose restart bff` 清掉。

## 验证
```bash
# CDP 拿 computed style
containerClass: "index-module__xVuIT__container"
containerDisplay: "flex"
containerMinHeight: "657px"      # 100vh
cardBg: "rgb(255, 255, 255)"
cardMaxWidth: "440px"
```

Chrome headless 截图 `/tmp/login-fixed.png`（344KB）显示：左侧橙色 BrandingSection 带 feature list，右侧白色卡片带 logo + 标题 + 表单 + 橙色登录按钮，布局完全正确。

## 给未来的提醒
- **不要再用 `injectType: 'lazyStyleTag'` 同时让用户代码用 `import styles from '...'` 直接读 className**。要么改用 `injectType: 'styleTag'`（非 lazy，default 就是 locals），要么改用 `import * as styles from '...'` 再 `styles.default.locals.X` / `styles.default.X`，要么用本文的 `?? _styles` 兼容写法。
- **改任何 CSS module loader 配置后**：旧的 `docker_bff-node-modules` volume 必须删掉（`docker volume rm`），否则 `cp -rn` 会把不存在的旧文件当 noop 留下、新文件被 `cp` 进去，但 npm bin/ 这种关键路径的覆盖关系会乱。
- **Turbopack + bind-mount 改文件后报 `Expected '</', got '<eof>'` 一律是 stale cache**，`rm -rf .next/cache && restart`。
