# 训练管理 - 肌肉群管理 设计文档

> 范围：实现 `/training/muscle-groups` 页面（参考 `docs/images/mucle_content.png`）。
> 涵盖 API 端点（CRUD）、Web 页面与 `packages/ui-components` 公共组件抽取。
> 含子肌群自关联（parentId）的树形展示与下钻。

## 一、需求

登录用户访问 `/training/muscle-groups` 看到：
- 3 个统计卡（总肌群数 / 关联动作总数 / 平均每肌群动作数）
- 一级肌群卡片网格（3 列），每张卡显示图标 / 名称 / 描述 / "关联动作 N"（N 用 accent 色）
- 顶部右侧"+ 添加肌群"按钮 → 弹出表单弹窗
- 点击任意肌群卡 → 打开详情弹窗：
  - 标题：肌群名 + 创建/修改时间
  - 描述区：文字描述
  - 父级（若有）：可点击回链
  - 子肌群列表（若有）：平铺，每行一个名字 + 关联动作数 + 右箭头，**点击继续下钻打开子肌群详情弹窗**
  - 底部操作：编辑 / 删除
- 添加/编辑表单含 parent 选择器（下拉选现有肌群，可空）
- API：完整 CRUD（GET 列表 / GET 单个 / POST / PATCH / DELETE）

## 二、数据模型

### Prisma（无变更）

`apps/api/prisma/schema.prisma` 已存在 `MuscleGroup` 模型：

```prisma
model MuscleGroup {
  id               String            @id @default(cuid())
  name             String
  description      String?
  parentId         String?
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  parent           MuscleGroup?      @relation("MuscleGroupHierarchy", fields: [parentId], references: [id])
  children         MuscleGroup[]     @relation("MuscleGroupHierarchy")
  excerciseMuscles ExcerciseMuscle[]
}
```

不需新 migration。DB 当前为空（无 seed），验证脚本会通过 API 注入测试数据。

### 自引用循环防护

PATCH 改 `parentId` 时禁止把节点移到其后代下。SQL 思路：

```sql
WITH RECURSIVE descendants AS (
  SELECT id FROM "MuscleGroup" WHERE "parentId" = $1
  UNION ALL
  SELECT mg.id FROM "MuscleGroup" mg JOIN descendants d ON mg."parentId" = d.id
)
SELECT EXISTS(SELECT 1 FROM descendants WHERE id = $2) AS would_cycle;
```

若为 true，返回 400 + 错误信息。

## 三、API 设计

`apps/api/src/modules/muscle-groups/`，全部 `@UseGuards(JwtAuthGuard)`，从 JWT 取 userId（userId 当前不参与业务过滤，保留鉴权防止被匿名调用）。

### `GET /api/muscle-groups`

返回扁平数组（含 `parentId`），附 `exerciseCount`：

```sql
SELECT mg.id, mg.name, mg.description, mg."parentId", mg."isActive",
       mg."createdAt", mg."updatedAt",
       COUNT(em.id)::int AS "exerciseCount"
FROM "MuscleGroup" mg
LEFT JOIN "ExcerciseMuscle" em ON em."muscleGroupId" = mg.id
GROUP BY mg.id
ORDER BY mg."createdAt" ASC;
```

响应：
```ts
type MuscleGroupListItem = {
  id: string
  name: string
  description: string | null
  parentId: string | null
  isActive: boolean
  exerciseCount: number
  createdAt: string
  updatedAt: string
}
```

### `GET /api/muscle-groups/:id`

返回单个（结构同上），供编辑表单回填。404 if not found。

### `POST /api/muscle-groups`

Body（`CreateMuscleGroupDto`）：
```ts
{ name: string (min 1), description?: string, parentId?: string, isActive?: boolean }
```
- 若 `parentId` 非空，校验存在
- 201 + 创建的实体

### `PATCH /api/muscle-groups/:id`

Body（`UpdateMuscleGroupDto` = `PartialType(CreateMuscleGroupDto)`）。若传 `parentId`：
- 校验存在
- 校验非自引用 + 非循环引用（用上面 CTE）
- 200 + 更新后实体

### `DELETE /api/muscle-groups/:id`

- 若 `ExcerciseMuscle` 有引用 → 409 + `{ message: '该肌群仍被 N 个动作引用，无法删除' }`
- 否则删除 + 204

### 错误约定

| 状态码 | 含义 |
|---|---|
| 400 | 校验失败（含循环引用） |
| 401 | 未登录 |
| 404 | 资源不存在 |
| 409 | 仍有引用，无法删除 |

## 四、Web 组件设计

### `packages/ui-components` 新增

| 组件 | Props | 备注 |
|---|---|---|
| `Modal` | `{ open, onClose, title, children, footer?, size?: 'sm'\|'md'\|'lg' }` | 居中浮层 + 半透明 backdrop；ESC 关闭；body 滚动锁；点击 backdrop 关闭 |
| `MuscleGroupCard` | `{ group, exerciseCount, accent, onSelect }` | 单张一级肌群卡：rounded-xl、白底 + 极淡 accent tint、accent 圆角图标、名称 / 描述 / 底部"关联动作 N"（N 用 accent 色） |
| `MuscleGroupDetailDialog` | `{ open, group, exerciseCount, parentName?, children, onClose, onEdit, onDelete, onSelectChild }` | 弹窗：标题（名 + 时间）/ 描述 / 父级（链）/ 子肌群列表（点击递归打开下一层）/ 编辑+删除 |
| `MuscleGroupFormDialog` | `{ open, mode: 'create'\|'edit', group?, parentOptions, defaultParentId?, onClose, onSubmit }` | 表单弹窗：name (required) / description (textarea) / parent (select, 可空) / isActive (switch) |

### 树组装

`useMuscleGroups()` 内部把扁平数组组装为树：

```ts
const tree = useMemo(() => {
  const map = new Map(items.map(g => [g.id, { ...g, children: [] }]))
  const roots = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}, [items])
```

### 详情弹窗的下钻

`MuscleGroups.tsx` 维护 `detailStack: MuscleGroupListItem[]`，点击子肌群 → 入栈并打开新弹窗；弹窗自己的"关闭"按钮出栈。父级回链也走相同机制（入栈父级）。

简化方案（本次）：每层弹窗独立 `<Modal open={...}>`，栈用 `useState<MuscleGroupListItem[]>` 管；每层只渲染栈顶。

### 色彩策略

5 种 accent：`orange / blue / green / purple / pink`。`MuscleGroupCard` 通过 `accentFor(group.name)`（按名字 hash）保证同一肌群每次颜色一致。子肌群复用父级 accent（通过 `parentAccentFor(group)` 向上找）。

### Hooks

| Hook | 行为 |
|---|---|
| `useMuscleGroups()` | `useQuery(['muscleGroups'], muscleGroupsService.list)`，`staleTime: 30s`，返回扁平 + `tree` |
| `useMuscleGroup(id)` | `useQuery(['muscleGroup', id], () => muscleGroupsService.getOne(id), { enabled: !!id })` |
| `useMuscleGroupMutations()` | 返回 `{ create, update, remove }`，成功后 `qc.invalidateQueries(['muscleGroups'])` |

## 五、页面结构

`apps/web/src/pages/Layout/Training/MuscleGroups.tsx`（替换现有 PlaceholderPage）：

```
<header>
  <h1>肌肉群管理</h1>
  <p>管理和编辑肌肉群分类</p>
  <Button (right): "+ 添加肌肉群" → setFormOpen({mode:'create'})>
</header>

<StatsRow columns=3>（复用 StatsCard + StatsCardGroup）
  item 1: { icon: Layers,     value: total,        label: '总肌肉群', accent: blue }
  item 2: { icon: Link,       value: totalEx,      label: '关联动作', accent: orange }
  item 3: { icon: BarChart3,  value: avg,          label: '平均动作数', accent: green }
</StatsRow>

<SectionCard title="">
  <grid cols-3>
    {tree.map(node => <MuscleGroupCard ... onSelect={() => detailStack.push(node)} />)}
  </grid>
  {tree.length === 0 && <EmptyState message="还没有肌群，点击右上角添加第一个" />}
</SectionCard>

{detailStack.length > 0 && <MuscleGroupDetailDialog open group={top} children={top.children} ... />}
{formOpen && <MuscleGroupFormDialog mode={formOpen.mode} ... />}
```

**统计派生**：
```ts
const total = items.length
const totalExercises = items.reduce((s, i) => s + i.exerciseCount, 0)
const avg = total === 0 ? 0 : Math.round(totalExercises / total)
```

## 六、错误处理 / 边界

| 场景 | 行为 |
|---|---|
| 未登录 | 路由 `ProtectedRoute` 兜底跳 `/login` |
| API 401 | ErrorBoundary 兜底（react-query 默认 throw） |
| 409 删除被引用 | 弹窗内红字提示 "该肌群仍被 N 个动作引用，无法删除" |
| 网络断开 | react-query 自动 retry 1 次；失败交 ErrorBoundary |
| 详情弹窗打开时 API 失败 | 关闭弹窗 + 简易 toast（`<div role="alert">` 浮层 2s 自动消失，**不引入第三方 toast 库**） |
| 空数据 | 显示 EmptyState CTA |

## 七、依赖 / 配置

- API：无新增 npm 包（用既有 `pg`、`class-validator`、`@nestjs/common`）
- web：无新增（react-query 已在依赖里）
- `packages/ui-components`：无新增（无图标库扩展——复用 lucide-react）

`packages/ui-components/package.json` 的 dependencies 已有 `lucide-react`，直接使用 `Layers / Link / BarChart3 / Edit2 / Trash2 / ChevronRight / X` 等。

## 八、文件结构

```
apps/api/src/modules/muscle-groups/
  muscle-groups.module.ts          # 新增
  muscle-groups.service.ts         # 新增（含循环引用 CTE）
  muscle-groups.controller.ts      # 新增（5 个端点）
  dto/create-muscle-group.dto.ts   # 新增
  dto/update-muscle-group.dto.ts   # 新增（PartialType）
apps/api/src/app.module.ts         # +MuscleGroupsModule
packages/ui-components/src/
  components/ui/modal.tsx                          # 新增
  components/ui/muscle-group-card.tsx              # 新增
  components/ui/muscle-group-detail-dialog.tsx     # 新增
  components/ui/muscle-group-form-dialog.tsx       # 新增
  lib/accent.ts                                    # 新增（hash → 5 色）
  index.ts                                         # +exports
apps/web/src/
  services/muscleGroupsService.ts                  # 新增（5 个 fetch）
  hooks/useMuscleGroups.ts                         # 新增（含 tree 组装）
  hooks/useMuscleGroup.ts                          # 新增
  hooks/useMuscleGroupMutations.ts                 # 新增
  pages/Layout/Training/MuscleGroups.tsx           # 改为 orchestrator
  styles/index.css                                 # +@source inline（accent / modal 用到的新工具类）
scripts-tmp/muscle-groups-verify.mjs               # 新增（CDP e2e）
```

## 九、实现步骤

1. **API 层**
   - `apps/api/src/modules/muscle-groups/` 三件套 + 两个 DTO
   - `AppModule` 注册
   - curl 5 个端点烟测（演示账号 token）
2. **ui-components**
   - `Modal / MuscleGroupCard / MuscleGroupDetailDialog / MuscleGroupFormDialog / accent util`
   - build（tsup + tsc）
3. **Web 数据层**
   - `services / hooks` 三件
4. **页面**
   - `MuscleGroups.tsx` 改为 orchestrator
   - `styles/index.css` 追加 @source inline 类名
5. **e2e 验证脚本 + 跑通**
6. **commit + 推 feature/lijm**

## 十、范围外

- 拖拽排序
- 关联动作的具体列表（详情弹窗只展示数量 + "查看动作"占位入口）
- 批量导入 / 导出
- 国际化（i18n）
- 软删除/回收站
- 实时多人协作

以上均留作后续迭代。