# 动作管理 (Exercise Management) 设计

**Date:** 2026-07-26

## 目标

实现「动作管理」模块:管理和编辑健身动作库。UI 参考 `docs/images/excercises_content.png`。整体镜像已建成的 muscle-groups 模块的分层与代码风格。

现状(探索结论,均已存在,无需新建):
- DB 表 `"Excercises"`(拼写如此,须保留)+ 关联表 `"ExcerciseMuscle"`(→ `"MuscleGroup"`),已在 migration `20260520081703_init` 中创建。**本模块无需新增 migration。**
- 后端 stub 目录 `apps/api/src/modules/excercises/`(controller/module 为空,service 为损坏的占位),未注册进 `app.module.ts`。
- 前端占位页 `apps/web/src/pages/Layout/Training/Exercises.tsx`(仅渲染 PlaceholderPage)。
- 路由 `/training/exercises` 与导航「动作管理」已在 `routes/index.tsx` / `config/modules.ts` 接好,**无需改动路由与导航**。

## 已确认的关键决策

1. **目标肌群** → 关联已有 `MuscleGroup` 表(经 `ExcerciseMuscle` 关联),表单用肌群多选 picker。不使用 `Excercises.targetMuscles String[]` 自由文本列。
2. **分类 (category)** → 固定枚举 `Int 1-6`,前后端共享映射。
3. **功能范围** → 完整 CRUD(列表 + 搜索 + 分类筛选 + 新建/编辑/删除,含表单弹窗与详情弹窗)。
4. **种子数据** → 补种肌群 + 设计稿 4 个示例动作。

补充(实现方设计时替用户定,低风险):
- **器械 (equipment)** → 自由文本标签数组 `String[]`;展示用「、」连接。
- **卡片布局** → 整行卡片(设计稿如此),非 muscle-groups 的网格。
- **难度 (difficulty)** → `Int 1-3`:1 初级(绿)/2 中级(蓝)/3 高级(红)。

## 枚举常量(前后端共享定义)

分类 category:
| 值 | 标签 |
| --- | --- |
| 1 | 胸部 |
| 2 | 背部 |
| 3 | 腿部 |
| 4 | 肩部 |
| 5 | 手臂 |
| 6 | 核心 |

难度 difficulty:
| 值 | 标签 | 徽章配色(浅底/深字) |
| --- | --- | --- |
| 1 | 初级 | `bg-[#E3F4EC]` / `text-[#35B87A]` |
| 2 | 中级 | `bg-[#E5F0FF]` / `text-[#3B91F5]` |
| 3 | 高级 | `bg-[#FFE7EC]` / `text-[#FF5A67]` |

前端定义在 `apps/web/src/components/exercises/constants.ts`;后端在 service/DTO 校验中用相同数值范围(1-6 / 1-3)。

## 数据模型(复用现有表,拼写保留)

`"Excercises"` 本期暴露/使用的列:
- `id TEXT PK`(`gen_random_uuid()::text` 生成)
- `name TEXT NOT NULL`
- `description TEXT`(可空)
- `category INT`(1-6,默认 1)
- `difficulty INT`(1-3,默认 1)
- `equipment TEXT[]`(自由文本标签)
- `isActive BOOLEAN`(默认 true)
- `createdAt` / `updatedAt`

本期**不使用**:`targetMuscles TEXT[]`(被关联表取代,留空)、`duration/reps/sets/imageUrl/videoUrl/notes`(设计稿未出现,YAGNI)。

`"ExcerciseMuscle"` 关联行:
- `excerciseId` → `Excercises.id`
- `muscleGroupId` → `MuscleGroup.id`
- `weight INT`(本期不暴露,插入固定 `0`)
- `isPrimary BOOLEAN`(本期不暴露,插入固定 `false`)
- `@@unique([excerciseId, muscleGroupId])`,两侧 FK `onDelete: Cascade`

## 后端(`apps/api/src/modules/excercises/`)

填充现有 stub,并在 `app.module.ts` 的 `imports` 加入 `ExcercisesModule`。

**HTTP 路由**用正确拼写 `exercises`(`@Controller('exercises')`);内部目录/类名/表名保留 `excercises`/`Excercises`。整个控制器 `@UseGuards(JwtAuthGuard)`。

端点:
| Method | Path | Handler |
| --- | --- | --- |
| GET | `/exercises` | `list()` |
| GET | `/exercises/:id` | `detail(@Param id)` |
| POST | `/exercises` | `create(@Body dto)` |
| PATCH | `/exercises/:id` | `update(@Param id, @Body dto)` |
| DELETE | `/exercises/:id` | `remove(@Param id)` → `{ deleted: true }` |

**Service**(原生 SQL,经 `DatabaseService.query`):
- `list` / `detail`:
  ```sql
  SELECT e.id, e.name, e.description, e.category, e.difficulty, e.equipment,
         e."isActive", e."createdAt", e."updatedAt",
         COALESCE(
           json_agg(json_build_object('id', mg.id, 'name', mg.name)
                    ORDER BY mg.name)
           FILTER (WHERE mg.id IS NOT NULL), '[]'
         ) AS "targetMuscles"
  FROM "Excercises" e
  LEFT JOIN "ExcerciseMuscle" em ON em."excerciseId" = e.id
  LEFT JOIN "MuscleGroup" mg ON mg.id = em."muscleGroupId"
  -- detail: WHERE e.id = $1
  GROUP BY e.id
  ORDER BY e."createdAt" ASC;
  ```
- `create(dto)`:事务内 —— 校验 `muscleGroupIds` 均存在;`INSERT INTO "Excercises"`(id 用 `gen_random_uuid()::text`);对每个 `muscleGroupId` `INSERT INTO "ExcerciseMuscle"(excerciseId, muscleGroupId, weight, isPrimary)` 值 `(..., 0, false)`;返回 `detail(id)`。
- `update(id, dto)`:事务内 —— `assertExists`;用 `COALESCE` + `CASE WHEN $X::type` 做部分更新(`undefined` 不覆盖);若传入 `muscleGroupIds`,先 `DELETE FROM "ExcerciseMuscle" WHERE "excerciseId"=$1` 再重建;更新 `updatedAt`;返回 `detail(id)`。
- `remove(id)`:`assertExists`;`DELETE FROM "Excercises" WHERE id=$1`(关联行经 cascade 自动删)。
- `assertExists(id)`:不存在抛 `NotFoundException('动作不存在')`。
- 校验:category 不在 1-6 或 difficulty 不在 1-3 抛 `BadRequestException`;`muscleGroupIds` 存在性用一次 `SELECT id FROM "MuscleGroup" WHERE id = ANY($1)` 比对数量。

**DTO**(`dto/`,`class-validator` + 全局 `ValidationPipe({transform:true})`):
- `create-excercise.dto.ts`:
  - `@IsString @MinLength(1,{message:'名称不能为空'}) name`
  - `@IsInt @Min(1) @Max(6) category`
  - `@IsInt @Min(1) @Max(3) difficulty`
  - `@IsArray @IsString({each:true}) @IsOptional equipment?: string[]`
  - `@IsArray @IsString({each:true}) muscleGroupIds: string[]`
  - `@IsString @IsOptional description?`
  - `@IsBoolean @IsOptional isActive?`
- `update-excercise.dto.ts`:`extends PartialType(CreateExcerciseDto)`。

**module**:`controllers:[ExcercisesController]`,`providers:[ExcercisesService, DatabaseService]`,`exports:[ExcercisesService]`。

## 前端(`apps/web/src`)

**service** `services/exercisesService.ts`(镜像 `muscleGroupsService.ts`,全部走 `tryAuthedFetch` → `/api/exercises`):
```ts
export interface IExerciseTargetMuscle { id: string; name: string }
export interface IExercise {
  id: string; name: string; description: string | null;
  category: number; difficulty: number; equipment: string[];
  targetMuscles: IExerciseTargetMuscle[];
  isActive: boolean; createdAt: string; updatedAt: string;
}
export interface IExerciseInput {
  name: string; description?: string;
  category: number; difficulty: number;
  equipment?: string[]; muscleGroupIds: string[]; isActive?: boolean;
}
// list / getOne(id) / create(i) / update(id,i) / remove(id)
```

**hooks**(`hooks/`,镜像 muscle-groups,无 tree 版本):
- `useExercises.ts`:`queryKey ['exercises']`,`queryFn list()`,`staleTime 30_000`,返回 `{...query, items}`。
- `useExercise.ts`:`queryKey ['exercise', id]`,`enabled: !!id`。
- `useExerciseMutations.ts`:`create/update/remove` 三个 `useMutation`,单个 `invalidate()` 失效 `['exercises']` 与 `['exercise']`;不设 `onError`,页面用 try/catch 包 `mutateAsync`。

**components** `components/exercises/`:
- `constants.ts`:`CATEGORY_MAP`、`DIFFICULTY_MAP`(标签 + 徽章类名),及 `CATEGORY_OPTIONS`/`DIFFICULTY_OPTIONS` 供 chips 与 select 用。
- `ExerciseCard.tsx`:**整行**卡片。`rounded-2xl bg-[#F7FAFC]`(或 white)`p-5` + hover 阴影。首行:名称 `font-bold text-[#2D3748]` + 难度徽章;次行:`分类:xx  器械:a、b  目标肌群:m1、m2`(标签加粗 `text-[#4A5568]`,值 `text-[#718096]`)。props:`{ exercise: IExercise; onSelect?; className? }`。
- `ExerciseDetailDialog.tsx`:`Modal size="lg"`,展示全部字段;footer 含破坏性删除按钮(`border-[#FED7D7] text-[#C53030]`)+ 橙色编辑按钮。props:`{ exercise; onEdit; onDelete; onClose }`。
- `ExerciseFormDialog.tsx`:`Modal`,字段 —— name(必填)、分类 select、难度 select、器械标签输入(回车/逗号添加,可删)、**肌群多选 picker**(pill/checkbox 列表,来源 `useMuscleGroups()`,点击切换,选中态 `accent`/橙色)、description textarea。本地 state + `useEffect` 在 `open` 翻转时重置;错误红框 `bg-[#FFF5F5] text-[#C53030]`。props:`{ open; mode:'create'|'edit'; initial?; muscleGroupOptions; onClose; onSubmit }`,`onSubmit(values: IExerciseInput) => void | Promise<void>`。
- `index.ts`:barrel 导出上述组件、常量与类型。

**页面** 替换 `pages/Layout/Training/Exercises.tsx` 占位:
- Header:`h1 动作管理`(`text-2xl font-bold text-[#2D3748]`)+ 副标题「管理和编辑健身动作库」(`text-sm text-[#718096]`)+ 右上橙色「+ 添加动作」按钮(`bg-[#FF6B35]` + `shadow-[0_2px_8px_rgba(255,107,53,0.25)]`)。
- 工具行:左侧搜索框(`搜索动作名称...`,带放大镜图标)+ 右侧分类 chips(`全部` + 6 个),选中橙色实心,未选浅灰。
- 列表:`flex flex-col gap-4` 的 `ExerciseCard`。加载时 3~4 个骨架块(`h-24 animate-pulse rounded-2xl bg-[#F7FAFC]`);空态居中提示「还没有动作,点击右上角添加第一个。」。
- 弹窗:detail(点击卡片打开)+ form(新建/编辑)。删除用 `window.confirm` → `remove.mutateAsync`,失败 `window.alert(e.message)`。
- **筛选**:搜索与分类均**客户端**过滤内存中的 `items`(搜索按 name 包含;分类按 `category` 相等,`全部` 不过滤)。

**样式**:沿用设计 token(主色 `#FF6B35`、卡片 `rounded-2xl` + 既有阴影、徽章浅底深字)。若在 `apps/web/src/**` 之外(shared 组件)新用到工具类,需补进 `styles/index.css` 的 `@source inline(...)`;本模块组件都在 `apps/web/src` 内,通常无需补。

## 种子数据

在种子脚本中(以现行 `apps/api/prisma/seed.ts` / 活跃 seed 为准,实现阶段确认落点)追加,幂等 upsert:
- **肌群**(7 个,一级,`isActive true`):胸大肌、背阔肌、股四头肌、臀大肌、三角肌、肱二头肌、腹直肌。
- **动作**(4 个,含分类/难度/器械 + 关联肌群):
  | 名称 | category | difficulty | equipment | 关联肌群 |
  | --- | --- | --- | --- | --- |
  | 杠铃深蹲 | 3 腿部 | 2 中级 | 杠铃 | 股四头肌、臀大肌 |
  | 卧推 | 1 胸部 | 2 中级 | 杠铃 | 胸大肌、三角肌(前束→用三角肌) |
  | 硬拉 | 2 背部 | 3 高级 | 杠铃 | 背阔肌、臀大肌 |
  | 引体向上 | 2 背部 | 2 中级 | 单杠 | 背阔肌、肱二头肌 |

> 注:设计稿「三角肌前束」在本期简化为「三角肌」(肌群表只种一级)。

## 修改/新增文件

| 文件 | 变更 |
| --- | --- |
| `apps/api/src/modules/excercises/excercises.controller.ts` | 填充:5 端点 + JwtAuthGuard |
| `apps/api/src/modules/excercises/excercises.service.ts` | 重写:原生 SQL CRUD + 关联表事务 |
| `apps/api/src/modules/excercises/excercises.module.ts` | 填充:controllers/providers/exports |
| `apps/api/src/modules/excercises/dto/create-excercise.dto.ts` | 扩展为完整字段 |
| `apps/api/src/modules/excercises/dto/update-excercise.dto.ts` | **新增** PartialType |
| `apps/api/src/app.module.ts` | imports 加入 ExcercisesModule |
| `apps/api/prisma/seed.ts`(或活跃 seed) | 追加肌群 + 动作种子 |
| `apps/web/src/services/exercisesService.ts` | **新增** |
| `apps/web/src/hooks/useExercises.ts` | **新增** |
| `apps/web/src/hooks/useExercise.ts` | **新增** |
| `apps/web/src/hooks/useExerciseMutations.ts` | **新增** |
| `apps/web/src/components/exercises/constants.ts` | **新增** |
| `apps/web/src/components/exercises/ExerciseCard.tsx` | **新增** |
| `apps/web/src/components/exercises/ExerciseDetailDialog.tsx` | **新增** |
| `apps/web/src/components/exercises/ExerciseFormDialog.tsx` | **新增** |
| `apps/web/src/components/exercises/index.ts` | **新增** |
| `apps/web/src/pages/Layout/Training/Exercises.tsx` | 替换占位为完整实现 |

## 不修改

- 路由 `routes/index.tsx`、导航 `config/modules.ts`(已接好)。
- Prisma migration / DB schema(表已存在)。
- muscle-groups 模块、auth 层、shared ui-components(除非缺组件需补,届时再议)。

## 验证

1. `apps/api` `tsc --noEmit` 通过;`apps/web` `tsc -b` exit 0。
2. 种子跑通,肌群 7 条 + 动作 4 条落库,关联行正确。
3. API 手测/脚本:`GET /api/exercises` 返回含 `targetMuscles:[{id,name}]` 的数组;POST/PATCH/DELETE 正常;非法 category/difficulty 返回 400;不存在 id 返回 404。
4. CDP 走查 `/training/exercises`:列表渲染 4 个种子动作(名称+难度徽章+分类/器械/目标肌群);分类 chips 过滤;搜索按名称过滤;「添加动作」新建(含肌群多选);点击卡片查看详情 → 编辑 → 删除全链路;空态与加载骨架。
5. 无回归:`Login → /training/muscle-groups → /training/exercises` 正常。

## 风险与缓解

- **表/字段拼写不一致**:表 `"Excercises"`、关联 `"ExcerciseMuscle"` 均为历史误拼,SQL 必须保留,否则静默查空表。HTTP 路由用正确 `exercises`,通过 BFF `[...path]` 代理到 `/api/exercises`(同 muscle-groups 验证过的代理路径)。
- **肌群为空导致 picker 空**:靠种子先建肌群缓解;表单在无肌群时给出提示而非报错。
- **关联行事务**:create/update 的 Excercises 写入与关联行写入需同事务,避免半更新。
- **`weight/isPrimary` 默认值**:本期固定 `0/false`;后续如需「主要肌群」区分,再扩展表单与 SQL。
