# 概览 - 仪表盘 设计文档

> 范围：实现 `/overview/dashboard` 页面（参考 `docs/images/dashboard_content.png`）。
> 涵盖 Prisma 数据模型、API 端点、Web 页面与 `packages/ui-components` 公共组件抽取。

## 一、需求

登录用户访问 `/overview/dashboard` 看到 4 个统计卡 + 本周训练强度柱状图 + 最近 3 条训练记录。
- 4 卡：本周训练次数（次）/ 训练时长（分钟）/ 消耗热量（kcal）/ 达成目标（个，累计）
- 右上角 delta 徽标：
  - 前 3 卡（本周维度）：`thisWeek − lastWeek`，正数绿色，负数红色，0 灰色
  - 第 4 卡（累计）：本周新增数 `thisWeek.count`（语义：你本周又达成了 N 个目标）
- 本周训练强度：周一~周日 7 根柱子（百分比 0-100），柱顶标百分比（intensity > 0 才标，0 不显示文字）
- 最近 3 条训练：名称 / 时间 / 时长 / 动作数

## 二、数据模型

### Prisma 改动（`apps/api/prisma/schema.prisma`）

```prisma
model TrainingSession {
  id              String   @id @default(cuid())
  userId          String
  name            String              // "胸部+三头训练"
  startedAt       DateTime            // 实际开始时间
  durationMinutes Int                 // 训练时长（分钟）
  exerciseCount   Int                 // 动作数量
  intensity       Int                 // 0-100 完成度
  caloriesBurned  Int                 // 消耗热量（kcal）
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, startedAt])
}

model User {
  // 既有字段保持不变
  trainingSessions TrainingSession[]
}
```

不与 `Workout`（计划）关联：用户可自由打卡任意名称的训练。

### Seed（`apps/api/prisma/seed.ts`）

固定测试账号 `13800138000 / Test1234! / "演示账号"`。
- 本周 4 条（周一/二/三/五各 1）— 强度 60-95%
- 上周 3 条（周一/三/六各 1）— 强度 50-85%
- 累计 7 条
- 时长 60-90 分钟，热量 350-500 kcal
- 通过 `prisma db seed` 一键注入；seed 幂等（先删演示账号已有 TrainingSession 再插）

## 三、API 设计

`apps/api/src/modules/overview/` 三个端点，全部 `@UseGuards(JwtAuthGuard)`，从 JWT 取 userId：

### `GET /api/overview/stats`
返回：
```ts
{
  thisWeek:    { count: number, durationMinutes: number, caloriesBurned: number },
  total:       { count: number },              // "达成目标" 用这个
  lastWeek:    { count: number, durationMinutes: number, caloriesBurned: number }
}
```
SQL 思路：`COUNT(*)` / `SUM(...)` 两次，week 边界用 `date_trunc('week', NOW())`。

### `GET /api/overview/intensity?week=current`
返回：
```ts
{
  days: [
    { weekday: 1, date: '2026-07-06', intensity: 85 },
    ...  // 共 7 项，按 weekday 升序；weekday 1=周一, 7=周日
  ]
}
```
SQL 思路：`generate_series(0,6)` 构造 7 天 → `LEFT JOIN TrainingSession ON startedAt::date = d.date` → `COALESCE(AVG(intensity), 0)::int`。无记录 = 0。weekday 用 `EXTRACT(ISODOW FROM date)` 保证 1=周一 7=周日（与 DB locale 解耦）。

### `GET /api/overview/recent-sessions?limit=3`
返回 `TrainingSession[]` 按 `startedAt DESC LIMIT N`。`@Query('limit', { defaultValue: 3 })`。

## 四、Web 组件设计

### `packages/ui-components` 新增

| 组件 | Props | 备注 |
|---|---|---|
| `StatsCard` | `{ icon, value, label, delta?, color? }` | 圆角白底卡 + icon + 大数字 + label + 可选 delta 徽标 |
| `StatsCardGroup` | `{ items: StatsCardProps[], columns?: 2\|4 }` | 4 列响应式 grid |
| `IntensityChart` | `{ data: IntensityDay[], height?: number }` | recharts BarChart 封装 |
| `SessionRecordItem` | `{ name, startedAt, durationMinutes, exerciseCount }` | 单条记录 UI |
| `SectionCard` | `{ title, children, className? }` | 浮岛容器（与 TopBar/LeftBar 一致视觉） |
| `formatRelativeDate` | `(date: string\|Date) => string` | util，"今天 HH:mm" / "昨天 HH:mm" / "M月D日" / "YYYY-MM-DD" |

`IntensityChart` 内部：
- `recharts` `<BarChart data={data}>` + `<CartesianGrid>` + `<XAxis dataKey="weekday">` + `<YAxis domain={[0, 100]}>` + `<Tooltip>` + `<Bar dataKey="intensity" fill="#FF6B35">`
- X 轴 weekday 显示中文（"周一"~"周日"）
- 柱顶百分比用 `<LabelList position="top" formatter={...} />`

### `OverviewDashboard.tsx`（web orchestrator）

3 个 react-query hook：
- `useOverviewStats()` → `GET /overview/stats`
- `useOverviewIntensity()` → `GET /overview/intensity`
- `useRecentSessions()` (内部传 `limit=3`) → `GET /overview/recent-sessions?limit=3`

结构：
```
<h1>训练概览</h1>
<p>你的健身数据一览</p>
<StatsCardGroup items={[...4 cards]} />
<SectionCard title="本周训练强度">
  <IntensityChart data={...} />
</SectionCard>
<SectionCard title="最近训练记录">
  {recent.map(s => <SessionRecordItem {...s} />)}
</SectionCard>
```

每个 hook 维护 `isLoading` → 用 Tailwind `animate-pulse` 占位 div 显示骨架。
Error 直接抛给顶层 ErrorBoundary（路由已配）。

### 路径

- `apps/web/src/services/overviewService.ts`（3 个 fetch 函数）
- `apps/web/src/hooks/useOverviewStats.ts` / `useOverviewIntensity.ts` / `useRecentSessions.ts`

## 五、错误处理 / 边界

- 未登录 → 路由 `ProtectedRoute` 兜底跳 `/login`
- API 401 → 401 不在本次范围；用户层只处理业务错误
- 数据库为空（演示账号刚 seed 完成一定有数据）→ 各 section 渲染 0 / 空数组即可
- 训练强度 7 天无任何记录 → 7 根柱子全为 0，UI 仍然展示

## 六、依赖

- `packages/ui-components/package.json` 新增 `"recharts": "^2.x"`（直接 deps）
- `apps/web` 端：因为 `pnpm-workspace.yaml` 开启 `node-linker=hoisted`，recharts 会自动出现在根 `node_modules`，web 间接消费；**不需要在 `apps/web/package.json` 重复声明**（避免版本漂移）
- 其余无新增（日期格式化手写、react-query 已有、zustand 也有但本次不用）

## 七、文件结构

```
apps/api/prisma/
  schema.prisma                          # +TrainingSession
  seed.ts                                # 新增
  migrations/.../.../migration.sql       # prisma migrate dev 自动生成
apps/api/src/modules/overview/
  overview.module.ts
  overview.service.ts
  overview.controller.ts
apps/api/src/app.module.ts               # +OverviewModule
packages/ui-components/src/
  components/ui/stats-card.tsx           # 新增
  components/ui/stats-card-group.tsx
  components/ui/intensity-chart.tsx
  components/ui/session-record-item.tsx
  components/ui/section-card.tsx
  lib/formatDate.ts                      # 新增
  index.ts                               # +exports
apps/web/src/
  services/overviewService.ts            # 新增
  hooks/useOverviewStats.ts              # 新增
  hooks/useOverviewIntensity.ts          # 新增
  hooks/useRecentSessions.ts             # 新增
  pages/Layout/Overview/Dashboard.tsx    # 改为 orchestrator
```

## 八、实现步骤

1. Prisma schema 加 `TrainingSession` + `User` 反向关系；`pnpm prisma migrate dev --name add-training-session`
2. `prisma/seed.ts` + `package.json` prisma.seed 配置；`pnpm prisma db seed`
3. `OverviewModule` 三件套；`AppModule` 注册
4. curl 三个端点烟测（带演示账号 token）
5. `packages/ui-components` 装 recharts；新增 5 组件 + formatDate util；导出；build
6. `web/src/services/overviewService.ts` 三个 fetch
7. `web/src/hooks/` 三个 react-query hook
8. `OverviewDashboard.tsx` 改为 orchestrator
9. CDP e2e：登录演示账号 → /overview/dashboard → 校验 4 卡数字/徽标/7 柱/3 条记录与 seed 一致 → 刷新保留

## 九、范围外

- 单条 TrainingSession 的 CRUD（新增/编辑/删除）
- 训练时打卡（实时计时）功能
- 训练历史分页/筛选
- 训练动作明细（set/reps 记录）
- 与 Workout（计划）的关联
- 训练目标（Goal）独立表

以上均留作后续迭代。
