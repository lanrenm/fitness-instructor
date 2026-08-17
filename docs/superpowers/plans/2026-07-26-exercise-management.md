# 动作管理 (Exercise Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现「动作管理」CRUD 模块(列表 + 搜索 + 分类筛选 + 新建/编辑/删除),挂载到 `/training/exercises`,镜像 `muscle-groups` 模块的分层与代码风格。

**Architecture:** 后端 NestJS 模块(原生 SQL via `pg`,事务内同时写入 `Excercises` + `ExcerciseMuscle` 关联),前端 Vite + React 19(react-query 列表 + 弹窗编辑 + 客户端过滤)。HTTP 路由 `exercises`(正确拼写),内部目录/类/表名保留历史拼写 `excercises`/`Excercises`。BFF `[...path]` catch-all 已自动转发,无需改动。

**Tech Stack:** NestJS 11(class-validator + `DatabaseService.query`)、React 19、TanStack Query v5、Tailwind v4、`@fitness/ui-components` 的 `Modal`、`lucide-react` 图标。

---

## 文件总览

| 文件 | 职责 |
| --- | --- |
| **Backend** | |
| `apps/api/src/modules/excercises/excercises.controller.ts` | 5 端点 + `@UseGuards(JwtAuthGuard)` + `@Controller('exercises')` |
| `apps/api/src/modules/excercises/excercises.service.ts` | 原生 SQL: list/detail/create/update/remove + `assertExists` + `assertMuscleGroupsExist` |
| `apps/api/src/modules/excercises/excercises.module.ts` | controllers/providers/exports |
| `apps/api/src/modules/excercises/dto/create-excercise.dto.ts` | name/category/difficulty/equipment?/muscleGroupIds/description?/isActive? |
| `apps/api/src/modules/excercises/dto/update-excercise.dto.ts` | `extends PartialType(CreateExcerciseDto)` |
| `apps/api/src/app.module.ts` | imports 加入 `ExcercisesModule` |
| `apps/api/prisma/seed.ts` | 追加 9 个一级肌群 + 4 个动作(`upsert` + `deleteMany` 关联) |
| **Frontend** | |
| `apps/web/src/services/exercisesService.ts` | 5 个 fetch,镜像 `muscleGroupsService` |
| `apps/web/src/hooks/useExercises.ts` | `useQuery(['exercises'], list)`,返回 `{...query, items}` |
| `apps/web/src/hooks/useExercise.ts` | `useQuery(['exercise', id], getOne, enabled: !!id)` |
| `apps/web/src/hooks/useExerciseMutations.ts` | create/update/remove 三个 useMutation,失效 `['exercises']` 与 `['exercise']` |
| `apps/web/src/components/exercises/constants.ts` | `CATEGORY_MAP`、`DIFFICULTY_MAP`、chips/select 选项 |
| `apps/web/src/components/exercises/ExerciseCard.tsx` | 整行卡片(名称 + 难度徽章 + 分类/器械/目标肌群) |
| `apps/web/src/components/exercises/ExerciseDetailDialog.tsx` | `Modal size="lg"` 详情 + 删除/编辑按钮 |
| `apps/web/src/components/exercises/ExerciseFormDialog.tsx` | name/分类/难度/器械标签/肌群多选 picker/description |
| `apps/web/src/components/exercises/index.ts` | barrel 导出 |
| `apps/web/src/pages/Layout/Training/Exercises.tsx` | 完整页面:header + 搜索 + 分类 chips + 列表 + 弹窗 |

---

## Task 1: 后端 DTO —— CreateExcerciseDto + UpdateExcerciseDto

**Files:**
- Modify: `apps/api/src/modules/excercises/dto/create-excercise.dto.ts`(完整重写)
- Create: `apps/api/src/modules/excercises/dto/update-excercise.dto.ts`

- [ ] **Step 1: 重写 CreateExcerciseDto**

完全替换 `apps/api/src/modules/excercises/dto/create-excercise.dto.ts`(现内容是损坏的占位,直接覆写)为:

```ts
import { IsString, MinLength, IsInt, Min, Max, IsArray, IsOptional, IsBoolean, ArrayNotEmpty } from 'class-validator';

export class CreateExcerciseDto {
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  name: string;

  @IsInt()
  @Min(1)
  @Max(6)
  category: number;

  @IsInt()
  @Min(1)
  @Max(3)
  difficulty: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  @IsArray()
  @ArrayNotEmpty({ message: '至少选择一个目标肌群' })
  @IsString({ each: true })
  muscleGroupIds: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

- [ ] **Step 2: 新建 UpdateExcerciseDto**

创建 `apps/api/src/modules/excercises/dto/update-excercise.dto.ts`:

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateExcerciseDto } from './create-excercise.dto';

export class UpdateExcerciseDto extends PartialType(CreateExcerciseDto) {}
```

- [ ] **Step 3: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/api && pnpm tsc --noEmit
```

Expected: exit 0。

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/excercises/dto/
git commit -m "feat(api): exercise DTOs (create + update) with full validation"
```

---

## Task 2: 后端 Service —— ExcercisesService

**Files:**
- Modify: `apps/api/src/modules/excercises/excercises.service.ts`(完全重写,原占位是损坏的)

- [ ] **Step 1: 替换 service 实现**

完全替换 `apps/api/src/modules/excercises/excercises.service.ts` 为:

```ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database';
import { CreateExcerciseDto } from './dto/create-excercise.dto';
import { UpdateExcerciseDto } from './dto/update-excercise.dto';

const LIST_SQL = `
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
  GROUP BY e.id
  ORDER BY e."createdAt" ASC
`;

const FIND_ONE_SQL = `
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
  WHERE e.id = $1
  GROUP BY e.id
`;

@Injectable()
export class ExcercisesService {
  constructor(private db: DatabaseService) {}

  async findAll() {
    const r = await this.db.query(LIST_SQL);
    return r.rows;
  }

  async findOne(id: string) {
    const r = await this.db.query(FIND_ONE_SQL, [id]);
    if (r.rows.length === 0) throw new NotFoundException('动作不存在');
    return r.rows[0];
  }

  async create(dto: CreateExcerciseDto) {
    await this.assertMuscleGroupsExist(dto.muscleGroupIds);
    const client = await this.db.getPool().connect();
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO "Excercises" (id, name, description, category, difficulty, equipment, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, COALESCE($5, '{}'), COALESCE($6, true), NOW(), NOW())
         RETURNING id`,
        [
          dto.name,
          dto.description ?? null,
          dto.category,
          dto.difficulty,
          dto.equipment ?? null,
          dto.isActive ?? null,
        ],
      );
      const newId: string = ins.rows[0].id;
      for (const mgId of dto.muscleGroupIds) {
        await client.query(
          `INSERT INTO "ExcerciseMuscle" (id, "excerciseId", "muscleGroupId", weight, "isPrimary", "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, 0, false, NOW())`,
          [newId, mgId],
        );
      }
      await client.query('COMMIT');
      return this.findOne(newId);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async update(id: string, dto: UpdateExcerciseDto) {
    await this.assertExists(id);
    if (dto.muscleGroupIds !== undefined) {
      await this.assertMuscleGroupsExist(dto.muscleGroupIds);
    }
    const client = await this.db.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE "Excercises"
         SET name = COALESCE($2, name),
             description = CASE WHEN $3::boolean THEN $4 ELSE description END,
             category = COALESCE($5, category),
             difficulty = COALESCE($6, difficulty),
             equipment = CASE WHEN $7::boolean THEN $8 ELSE equipment END,
             "isActive" = COALESCE($9, "isActive"),
             "updatedAt" = NOW()
         WHERE id = $1`,
        [
          id,
          dto.name ?? null,
          dto.description !== undefined,
          dto.description ?? null,
          dto.category ?? null,
          dto.difficulty ?? null,
          dto.equipment !== undefined,
          dto.equipment ?? null,
          dto.isActive ?? null,
        ],
      );
      if (dto.muscleGroupIds !== undefined) {
        await client.query(
          `DELETE FROM "ExcerciseMuscle" WHERE "excerciseId" = $1`,
          [id],
        );
        for (const mgId of dto.muscleGroupIds) {
          await client.query(
            `INSERT INTO "ExcerciseMuscle" (id, "excerciseId", "muscleGroupId", weight, "isPrimary", "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, 0, false, NOW())`,
            [id, mgId],
          );
        }
      }
      await client.query('COMMIT');
      return this.findOne(id);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    // FK ON DELETE CASCADE handles ExcerciseMuscle rows automatically.
    await this.db.query(`DELETE FROM "Excercises" WHERE id = $1`, [id]);
  }

  private async assertExists(id: string) {
    const r = await this.db.query(
      `SELECT 1 FROM "Excercises" WHERE id = $1`,
      [id],
    );
    if (r.rows.length === 0) throw new NotFoundException('动作不存在');
  }

  private async assertMuscleGroupsExist(ids: string[]) {
    const r = await this.db.query(
      `SELECT id FROM "MuscleGroup" WHERE id = ANY($1::text[])`,
      [ids],
    );
    if (r.rows.length !== ids.length) {
      const found = new Set(r.rows.map((row) => row.id as string));
      const missing = ids.filter((id) => !found.has(id));
      throw new BadRequestException(
        `肌群不存在: ${missing.join(', ')}`,
      );
    }
  }
}
```

- [ ] **Step 2: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/api && pnpm tsc --noEmit
```

Expected: exit 0。

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/excercises/excercises.service.ts
git commit -m "feat(api): ExcercisesService with raw SQL CRUD + ExcerciseMuscle tx"
```

---

## Task 3: 后端 Controller + Module —— 注册路由

**Files:**
- Modify: `apps/api/src/modules/excercises/excercises.controller.ts`(原为空)
- Modify: `apps/api/src/modules/excercises/excercises.module.ts`(原为空)
- Modify: `apps/api/src/app.module.ts`(imports 加入 ExcercisesModule)

- [ ] **Step 1: 填充 controller**

完全覆写 `apps/api/src/modules/excercises/excercises.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ExcercisesService } from './excercises.service';
import { CreateExcerciseDto } from './dto/create-excercise.dto';
import { UpdateExcerciseDto } from './dto/update-excercise.dto';

@UseGuards(JwtAuthGuard)
@Controller('exercises')
export class ExcercisesController {
  constructor(private readonly service: ExcercisesService) {}

  @Get()
  list() {
    return this.service.findAll();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateExcerciseDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExcerciseDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { deleted: true };
  }
}
```

- [ ] **Step 2: 填充 module**

完全覆写 `apps/api/src/modules/excercises/excercises.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { ExcercisesController } from './excercises.controller';
import { ExcercisesService } from './excercises.service';

@Module({
  controllers: [ExcercisesController],
  providers: [ExcercisesService, DatabaseService],
  exports: [ExcercisesService],
})
export class ExcercisesModule {}
```

- [ ] **Step 3: 注册到 AppModule**

编辑 `apps/api/src/app.module.ts`,在第 8 行下加 import,第 12 行 imports 数组加 `ExcercisesModule`:

第 8 行后插入:
```ts
import { ExcercisesModule } from './modules/excercises/excercises.module';
```

第 12 行 `imports: [AuthModule, OverviewModule, MuscleGroupsModule],` 改为:
```ts
  imports: [AuthModule, OverviewModule, MuscleGroupsModule, ExcercisesModule],
```

- [ ] **Step 4: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/api && pnpm tsc --noEmit
```

Expected: exit 0。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/excercises/excercises.controller.ts apps/api/src/modules/excercises/excercises.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): Excercises controller + module + AppModule wiring"
```

---

## Task 4: Seed 数据 —— 9 个肌群 + 4 个动作

**Files:**
- Modify: `apps/api/prisma/seed.ts`(追加肌群 + 动作 seed 段)

- [ ] **Step 1: 在 seed 末尾追加肌群 + 动作**

编辑 `apps/api/prisma/seed.ts`,在 `await prisma.trainingSession.createMany(...)` 之后、`const count = await ...` 之前,插入下列两个 upsert 块:

```ts
  // 4. 幂等 upsert 一级肌群（设计稿 4 个动作所需）
  const muscleGroups = [
    { name: '胸大肌', description: '胸部主要肌群' },
    { name: '背阔肌', description: '背部主要肌群' },
    { name: '股四头肌', description: '大腿前侧肌群' },
    { name: '臀大肌', description: '臀部主要肌群' },
    { name: '三角肌', description: '肩部肌群' },
    { name: '肱二头肌', description: '上臂前侧肌群' },
    { name: '腹直肌', description: '腹部核心肌群' },
    { name: '竖脊肌', description: '背部深层肌群，维持脊柱稳定' },
    { name: '腘绳肌', description: '大腿后侧肌群' },
  ];
  const muscleGroupByName = new Map<string, string>();
  for (const mg of muscleGroups) {
    const row = await prisma.muscleGroup.upsert({
      where: { id: `seed-muscle-${mg.name}` },
      update: { description: mg.description, isActive: true },
      create: {
        id: `seed-muscle-${mg.name}`,
        name: mg.name,
        description: mg.description,
        isActive: true,
      },
    });
    muscleGroupByName.set(mg.name, row.id);
  }

  // 5. 幂等 upsert 设计稿 4 个动作
  const exercises = [
    { name: '杠铃深蹲', category: 3, difficulty: 2, equipment: ['杠铃'],
      muscles: ['股四头肌', '臀大肌'] },
    { name: '卧推',     category: 1, difficulty: 2, equipment: ['杠铃'],
      muscles: ['胸大肌', '三角肌'] },
    { name: '硬拉',     category: 2, difficulty: 3, equipment: ['杠铃'],
      muscles: ['竖脊肌', '臀大肌', '腘绳肌'] },
    { name: '引体向上', category: 2, difficulty: 2, equipment: ['单杠'],
      muscles: ['背阔肌', '肱二头肌'] },
  ];
  for (const ex of exercises) {
    const existing = await prisma.excercises.findFirst({ where: { name: ex.name } });
    let exerciseId: string;
    if (existing) {
      exerciseId = existing.id;
      await prisma.excercises.update({
        where: { id: existing.id },
        data: {
          category: ex.category,
          difficulty: ex.difficulty,
          equipment: ex.equipment,
        },
      });
      await prisma.excerciseMuscle.deleteMany({ where: { excerciseId: existing.id } });
    } else {
      const created = await prisma.excercises.create({
        data: {
          name: ex.name,
          category: ex.category,
          difficulty: ex.difficulty,
          equipment: ex.equipment,
        },
      });
      exerciseId = created.id;
    }
    for (const muscleName of ex.muscles) {
      const mgId = muscleGroupByName.get(muscleName);
      if (!mgId) continue;
      await prisma.excerciseMuscle.create({
        data: {
          excerciseId: exerciseId,
          muscleGroupId: mgId,
          weight: 0,
          isPrimary: false,
        },
      });
    }
  }

  const muscleCount = await prisma.muscleGroup.count();
  const exerciseCount = await prisma.excercises.count();
  console.log(`[seed] muscleGroups=${muscleCount}, exercises=${exerciseCount}`);
```

- [ ] **Step 2: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/api && pnpm tsc --noEmit
```

Expected: exit 0。

- [ ] **Step 3: 跑 seed(假设本地 DB 已起,api 容器可达)**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/api && pnpm prisma db seed
```

Expected: 输出 `[seed] user ... has N TrainingSessions` + `[seed] muscleGroups=9, exercises=4`。

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat(api): seed 9 muscle groups + 4 example exercises"
```

---

## Task 5: 前端 Service —— exercisesService

**Files:**
- Create: `apps/web/src/services/exercisesService.ts`

- [ ] **Step 1: 新建 service**

```ts
/**
 * @description 动作管理 - 5 个 CRUD fetch
 */

import { tryAuthedFetch } from './http';

export interface IExerciseTargetMuscle {
  id: string;
  name: string;
}

export interface IExercise {
  id: string;
  name: string;
  description: string | null;
  category: number;
  difficulty: number;
  equipment: string[];
  targetMuscles: IExerciseTargetMuscle[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IExerciseInput {
  name: string;
  description?: string;
  category: number;
  difficulty: number;
  equipment?: string[];
  muscleGroupIds: string[];
  isActive?: boolean;
}

export const exercisesService = {
  async list(): Promise<IExercise[]> {
    const res = await tryAuthedFetch('/api/exercises');
    if (!res.ok) throw new Error(await safeMsg(res, '获取动作列表失败'));
    return res.json();
  },

  async getOne(id: string): Promise<IExercise> {
    const res = await tryAuthedFetch(`/api/exercises/${id}`);
    if (!res.ok) throw new Error(await safeMsg(res, '获取动作详情失败'));
    return res.json();
  },

  async create(input: IExerciseInput): Promise<IExercise> {
    const res = await tryAuthedFetch('/api/exercises', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await safeMsg(res, '创建动作失败'));
    return res.json();
  },

  async update(id: string, input: Partial<IExerciseInput>): Promise<IExercise> {
    const res = await tryAuthedFetch(`/api/exercises/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await safeMsg(res, '更新动作失败'));
    return res.json();
  },

  async remove(id: string): Promise<void> {
    const res = await tryAuthedFetch(`/api/exercises/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await safeMsg(res, '删除动作失败'));
  },
};

async function safeMsg(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return (data as { message?: string }).message ?? fallback;
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 2: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/web && pnpm tsc -b
```

Expected: exit 0。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/services/exercisesService.ts
git commit -m "feat(web): exercisesService with 5 CRUD fetch methods"
```

---

## Task 6: 前端 Hooks —— useExercises + useExercise + useExerciseMutations

**Files:**
- Create: `apps/web/src/hooks/useExercises.ts`
- Create: `apps/web/src/hooks/useExercise.ts`
- Create: `apps/web/src/hooks/useExerciseMutations.ts`

- [ ] **Step 1: 新建 useExercises**

```ts
import { useQuery } from '@tanstack/react-query';
import { exercisesService } from '../services/exercisesService';

export function useExercises() {
  const query = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exercisesService.list(),
    staleTime: 30_000,
  });
  return { ...query, items: query.data ?? [] };
}
```

- [ ] **Step 2: 新建 useExercise**

```ts
import { useQuery } from '@tanstack/react-query';
import { exercisesService } from '../services/exercisesService';

export function useExercise(id: string | null) {
  return useQuery({
    queryKey: ['exercise', id],
    queryFn: () => exercisesService.getOne(id as string),
    enabled: !!id,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 3: 新建 useExerciseMutations**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  exercisesService,
  type IExerciseInput,
} from '../services/exercisesService';

export function useExerciseMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['exercises'] });
    qc.invalidateQueries({ queryKey: ['exercise'] });
  };

  const create = useMutation({
    mutationFn: (input: IExerciseInput) => exercisesService.create(input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<IExerciseInput>;
    }) => exercisesService.update(id, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => exercisesService.remove(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
```

- [ ] **Step 4: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/web && pnpm tsc -b
```

Expected: exit 0。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useExercises.ts apps/web/src/hooks/useExercise.ts apps/web/src/hooks/useExerciseMutations.ts
git commit -m "feat(web): useExercises + useExercise + useExerciseMutations"
```

---

## Task 7: 前端常量 —— components/exercises/constants.ts

**Files:**
- Create: `apps/web/src/components/exercises/constants.ts`

- [ ] **Step 1: 新建 constants**

```ts
/**
 * @description 动作管理 - 分类 / 难度常量(与后端 enum 对齐)
 */

export interface ICategoryOption {
  value: number;
  label: string;
}

export interface IDifficultyOption {
  value: number;
  label: string;
  badgeBg: string;
  badgeFg: string;
}

export const CATEGORY_MAP: Record<number, string> = {
  1: '胸部',
  2: '背部',
  3: '腿部',
  4: '肩部',
  5: '手臂',
  6: '核心',
};

export const DIFFICULTY_MAP: Record<number, IDifficultyOption> = {
  1: { value: 1, label: '初级', badgeBg: 'bg-[#E3F4EC]', badgeFg: 'text-[#35B87A]' },
  2: { value: 2, label: '中级', badgeBg: 'bg-[#E5F0FF]', badgeFg: 'text-[#3B91F5]' },
  3: { value: 3, label: '高级', badgeBg: 'bg-[#FFE7EC]', badgeFg: 'text-[#FF5A67]' },
};

export const CATEGORY_OPTIONS: ICategoryOption[] = Object.entries(CATEGORY_MAP)
  .map(([value, label]) => ({ value: Number(value), label }))
  .sort((a, b) => a.value - b.value);

export const DIFFICULTY_OPTIONS: IDifficultyOption[] = [1, 2, 3].map(
  (v) => DIFFICULTY_MAP[v],
);

export function categoryLabel(value: number): string {
  return CATEGORY_MAP[value] ?? `分类${value}`;
}

export function difficultyOption(value: number): IDifficultyOption {
  return DIFFICULTY_MAP[value] ?? DIFFICULTY_MAP[1];
}
```

- [ ] **Step 2: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/web && pnpm tsc -b
```

Expected: exit 0。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/exercises/constants.ts
git commit -m "feat(web): exercises constants (CATEGORY/DIFFICULTY maps)"
```

---

## Task 8: 前端 ExerciseCard 组件

**Files:**
- Create: `apps/web/src/components/exercises/ExerciseCard.tsx`

- [ ] **Step 1: 新建 ExerciseCard**

```tsx
import type { IExercise } from '../../services/exercisesService';
import { categoryLabel, difficultyOption } from './constants';

export interface ExerciseCardProps {
  exercise: IExercise;
  onSelect?: () => void;
  className?: string;
}

export function ExerciseCard({ exercise, onSelect, className }: ExerciseCardProps) {
  const diff = difficultyOption(exercise.difficulty);
  const muscles = exercise.targetMuscles.map((m) => m.name).join('、');
  const equipment = exercise.equipment.length > 0 ? exercise.equipment.join('、') : '无';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        'group flex w-full flex-col gap-2 rounded-2xl bg-[#F7FAFC] p-5 text-left transition hover:bg-[#F1F5F9] hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] ' +
        (className ?? '')
      }
    >
      <div className="flex items-center gap-3">
        <span className="text-base font-bold text-[#2D3748]">{exercise.name}</span>
        <span
          className={
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' +
            diff.badgeBg +
            ' ' +
            diff.badgeFg
          }
        >
          {diff.label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-medium text-[#4A5568]">
          分类：<span className="font-normal text-[#718096]">{categoryLabel(exercise.category)}</span>
        </span>
        <span className="font-medium text-[#4A5568]">
          器械：<span className="font-normal text-[#718096]">{equipment}</span>
        </span>
        <span className="font-medium text-[#4A5568]">
          目标肌群：<span className="font-normal text-[#718096]">{muscles || '无'}</span>
        </span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/web && pnpm tsc -b
```

Expected: exit 0。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/exercises/ExerciseCard.tsx
git commit -m "feat(web): ExerciseCard component (row-card layout)"
```

---

## Task 9: 前端 ExerciseDetailDialog 组件

**Files:**
- Create: `apps/web/src/components/exercises/ExerciseDetailDialog.tsx`

- [ ] **Step 1: 新建 ExerciseDetailDialog**

```tsx
import { Edit2, Trash2, ChevronRight } from 'lucide-react';
import { Modal } from '@fitness/ui-components';
import type { IExercise } from '../../services/exercisesService';
import { categoryLabel, difficultyOption } from './constants';

export interface ExerciseDetailDialogProps {
  open: boolean;
  exercise: IExercise;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ExerciseDetailDialog({ open, exercise, onClose, onEdit, onDelete }: ExerciseDetailDialogProps) {
  const diff = difficultyOption(exercise.difficulty);
  const muscles = exercise.targetMuscles.map((m) => m.name).join('、');
  const equipment = exercise.equipment.length > 0 ? exercise.equipment.join('、') : '无';

  return (
    <Modal open={open} onClose={onClose} size="lg"
      footer={
        <>
          {onDelete && (
            <button onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-[#FED7D7] bg-white px-4 py-2 text-sm font-medium text-[#C53030] hover:bg-[#FFF5F5]">
              <Trash2 size={14} /> 删除
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white hover:bg-[#E55A2B]">
              <Edit2 size={14} /> 编辑
            </button>
          )}
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#FFE8E1] text-[#FF6B35]">
          <ChevronRight size={22} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-[#2D3748]">{exercise.name}</h3>
            <span className={'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ' + diff.badgeBg + ' ' + diff.badgeFg}>
              {diff.label}
            </span>
          </div>
          <div className="mt-1 text-xs text-[#718096]">
            分类：{categoryLabel(exercise.category)}　|　器械：{equipment}
          </div>
        </div>
      </div>

      {exercise.description && (
        <p className="mt-4 text-sm leading-relaxed text-[#4A5568]">{exercise.description}</p>
      )}

      <div className="mt-4">
        <div className="text-xs text-[#718096]">目标肌群（{exercise.targetMuscles.length}）</div>
        {exercise.targetMuscles.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {exercise.targetMuscles.map((m) => (
              <span key={m.id} className="inline-flex items-center rounded-md border border-[#EDF2F7] bg-[#F7FAFC] px-2.5 py-1 text-xs text-[#2D3748]">
                {m.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-xs text-[#A0AEC0]">未指定</div>
        )}
      </div>

      <div className="mt-4 text-xs text-[#A0AEC0]">
        启用状态：{exercise.isActive ? '已启用' : '已停用'}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/web && pnpm tsc -b
```

Expected: exit 0。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/exercises/ExerciseDetailDialog.tsx
git commit -m "feat(web): ExerciseDetailDialog component"
```

---

## Task 10: 前端 ExerciseFormDialog 组件

**Files:**
- Create: `apps/web/src/components/exercises/ExerciseFormDialog.tsx`

- [ ] **Step 1: 新建 ExerciseFormDialog**

```tsx
import * as React from 'react';
import { Modal } from '@fitness/ui-components';
import { CATEGORY_OPTIONS, DIFFICULTY_OPTIONS } from './constants';
import type { IExercise, IExerciseInput } from '../../services/exercisesService';

export interface MuscleGroupOption {
  id: string;
  name: string;
}

export interface ExerciseFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: IExercise;
  muscleGroupOptions: MuscleGroupOption[];
  onClose: () => void;
  onSubmit: (values: IExerciseInput) => void | Promise<void>;
}

function equipmentToTags(value: string): string[] {
  return value
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ExerciseFormDialog({ open, mode, initial, muscleGroupOptions, onClose, onSubmit }: ExerciseFormDialogProps) {
  const [name, setName] = React.useState(initial?.name ?? '');
  const [category, setCategory] = React.useState(initial?.category ?? 1);
  const [difficulty, setDifficulty] = React.useState(initial?.difficulty ?? 1);
  const [equipmentInput, setEquipmentInput] = React.useState(
    initial?.equipment.join('、') ?? '',
  );
  const [selectedMuscles, setSelectedMuscles] = React.useState<string[]>(
    initial?.targetMuscles.map((m) => m.id) ?? [],
  );
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setCategory(initial?.category ?? 1);
    setDifficulty(initial?.difficulty ?? 1);
    setEquipmentInput(initial?.equipment.join('、') ?? '');
    setSelectedMuscles(initial?.targetMuscles.map((m) => m.id) ?? []);
    setDescription(initial?.description ?? '');
    setIsActive(initial?.isActive ?? true);
    setError(null);
  }, [open, initial]);

  const toggleMuscle = (id: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const title = mode === 'create' ? '添加动作' : '编辑动作';

  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#4A5568] hover:bg-[#F7FAFC]">取消</button>
          <button
            disabled={submitting || !name.trim() || selectedMuscles.length === 0}
            onClick={async () => {
              setSubmitting(true);
              setError(null);
              try {
                const equipment = equipmentToTags(equipmentInput);
                await onSubmit({
                  name: name.trim(),
                  category,
                  difficulty,
                  equipment,
                  muscleGroupIds: selectedMuscles,
                  description: description || undefined,
                  isActive,
                });
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : '提交失败');
              } finally {
                setSubmitting(false);
              }
            }}
            className="rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white hover:bg-[#E55A2B] disabled:opacity-50"
          >
            {submitting ? '提交中…' : '保存'}
          </button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">名称 <span className="text-[#E53E3E]">*</span></span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：杠铃深蹲"
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#4A5568]">分类</span>
            <select
              value={category}
              onChange={(e) => setCategory(Number(e.target.value))}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#4A5568]">难度</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
            >
              {DIFFICULTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">器械（多个用「、」或逗号分隔）</span>
          <input
            value={equipmentInput}
            onChange={(e) => setEquipmentInput(e.target.value)}
            placeholder="如：杠铃、哑铃"
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">
            目标肌群 <span className="text-[#E53E3E]">*</span>
            <span className="ml-2 text-[#A0AEC0]">（已选 {selectedMuscles.length}）</span>
          </span>
          {muscleGroupOptions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F7FAFC] px-3 py-3 text-xs text-[#718096]">
              暂无肌群，请先在「肌肉群管理」中添加。
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 rounded-lg border border-[#E2E8F0] bg-white p-3">
              {muscleGroupOptions.map((mg) => {
                const selected = selectedMuscles.includes(mg.id);
                return (
                  <button
                    type="button"
                    key={mg.id}
                    onClick={() => toggleMuscle(mg.id)}
                    className={
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs transition ' +
                      (selected
                        ? 'border-[#FF6B35] bg-[#FFE8E1] text-[#FF6B35]'
                        : 'border-[#E2E8F0] bg-white text-[#4A5568] hover:border-[#FF6B35]/50')
                    }
                  >
                    {mg.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">描述</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="动作说明（可选）"
            className="resize-none rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-[#FF6B35]"
          />
          <span className="text-sm text-[#4A5568]">启用</span>
        </label>

        {error && <div className="rounded-lg bg-[#FFF5F5] px-3 py-2 text-xs text-[#C53030]">{error}</div>}
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/web && pnpm tsc -b
```

Expected: exit 0。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/exercises/ExerciseFormDialog.tsx
git commit -m "feat(web): ExerciseFormDialog with muscle-group multi-pick"
```

---

## Task 11: 前端 barrel —— components/exercises/index.ts

**Files:**
- Create: `apps/web/src/components/exercises/index.ts`

- [ ] **Step 1: 新建 barrel**

```ts
export { ExerciseCard } from './ExerciseCard'
export type { ExerciseCardProps } from './ExerciseCard'
export { ExerciseDetailDialog } from './ExerciseDetailDialog'
export type { ExerciseDetailDialogProps } from './ExerciseDetailDialog'
export { ExerciseFormDialog } from './ExerciseFormDialog'
export type { ExerciseFormDialogProps, MuscleGroupOption } from './ExerciseFormDialog'
export {
  CATEGORY_MAP,
  DIFFICULTY_MAP,
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  categoryLabel,
  difficultyOption,
} from './constants'
export type { ICategoryOption, IDifficultyOption } from './constants'
```

- [ ] **Step 2: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/web && pnpm tsc -b
```

Expected: exit 0。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/exercises/index.ts
git commit -m "feat(web): exercises components barrel export"
```

---

## Task 12: 前端页面 —— Exercises.tsx(完整实现)

**Files:**
- Modify: `apps/web/src/pages/Layout/Training/Exercises.tsx`(完全替换占位)

- [ ] **Step 1: 替换 Exercises.tsx**

完全覆写 `apps/web/src/pages/Layout/Training/Exercises.tsx`:

```tsx
/**
 * @description 训练管理 - 动作管理：搜索 + 分类筛选 + 列表 + 详情弹窗 + 添加/编辑表单弹窗
 */
import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import {
  ExerciseCard,
  ExerciseDetailDialog,
  ExerciseFormDialog,
  CATEGORY_OPTIONS,
} from '../../../components/exercises'
import { useExercises } from '../../../hooks/useExercises'
import { useExerciseMutations } from '../../../hooks/useExerciseMutations'
import { useMuscleGroups } from '../../../hooks/useMuscleGroups'
import type { IExercise, IExerciseInput } from '../../../services/exercisesService'
import type { MuscleGroupOption } from '../../../components/exercises/ExerciseFormDialog'

type FormState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; exercise: IExercise }

const ALL_CATEGORIES = 'all'

export default function TrainingExercises() {
  const { items, isLoading } = useExercises()
  const { create, update, remove } = useExerciseMutations()
  const { items: muscleGroupItems } = useMuscleGroups()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<number | typeof ALL_CATEGORIES>(ALL_CATEGORIES)
  const [detail, setDetail] = useState<IExercise | null>(null)
  const [form, setForm] = useState<FormState>({ open: false })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((ex) => {
      if (categoryFilter !== ALL_CATEGORIES && ex.category !== categoryFilter) return false
      if (q && !ex.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, categoryFilter])

  const muscleGroupOptions: MuscleGroupOption[] = useMemo(
    () => muscleGroupItems.map((mg) => ({ id: mg.id, name: mg.name })),
    [muscleGroupItems],
  )

  const onDelete = async (exercise: IExercise) => {
    if (!window.confirm(`确认删除「${exercise.name}」？`)) return
    try {
      await remove.mutateAsync(exercise.id)
      setDetail(null)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败')
    }
  }

  const onSubmitForm = async (values: IExerciseInput) => {
    if (form.open && form.mode === 'create') {
      await create.mutateAsync(values)
    } else if (form.open && form.mode === 'edit') {
      await update.mutateAsync({ id: form.exercise.id, input: values })
    }
    setForm({ open: false })
    setDetail(null)
  }

  const formInitial: IExercise | undefined =
    form.open && form.mode === 'edit' ? form.exercise : undefined

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3748]">动作管理</h1>
          <p className="mt-1 text-sm text-[#718096]">管理和编辑健身动作库</p>
        </div>
        <button
          onClick={() => setForm({ open: true, mode: 'create' })}
          className="inline-flex items-center gap-1 rounded-xl bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(255,107,53,0.25)] hover:bg-[#E55A2B]"
        >
          <Plus size={14} /> 添加动作
        </button>
      </header>

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索动作名称..."
              className="w-full rounded-full border border-[#E2E8F0] bg-[#F7FAFC] py-2 pl-9 pr-3 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35] focus:bg-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryChip
              active={categoryFilter === ALL_CATEGORIES}
              onClick={() => setCategoryFilter(ALL_CATEGORIES)}
              label="全部"
            />
            {CATEGORY_OPTIONS.map((o) => (
              <CategoryChip
                key={o.value}
                active={categoryFilter === o.value}
                onClick={() => setCategoryFilter(o.value)}
                label={o.label}
              />
            ))}
          </div>
        </div>

        <div className="mt-5">
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#F7FAFC]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#718096]">
              {items.length === 0 ? '还没有动作，点击右上角添加第一个。' : '没有匹配的动作。'}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map((ex) => (
                <ExerciseCard key={ex.id} exercise={ex} onSelect={() => setDetail(ex)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {detail && (
        <ExerciseDetailDialog
          open
          exercise={detail}
          onClose={() => setDetail(null)}
          onEdit={() => setForm({ open: true, mode: 'edit', exercise: detail })}
          onDelete={() => onDelete(detail)}
        />
      )}

      {form.open && (
        <ExerciseFormDialog
          open
          mode={form.mode}
          initial={formInitial}
          muscleGroupOptions={muscleGroupOptions}
          onClose={() => {
            setForm({ open: false })
            setDetail(null)
          }}
          onSubmit={onSubmitForm}
        />
      )}
    </div>
  )
}

function CategoryChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full px-3.5 py-1 text-xs font-medium transition ' +
        (active
          ? 'bg-[#FF6B35] text-white shadow-[0_2px_6px_rgba(255,107,53,0.25)]'
          : 'bg-[#F7FAFC] text-[#4A5568] hover:bg-[#EDF2F7]')
      }
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 2: 验证 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/web && pnpm tsc -b
```

Expected: exit 0。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Layout/Training/Exercises.tsx
git commit -m "feat(web): TrainingExercises page (search + filter + CRUD dialogs)"
```

---

## Task 13: 端到端验证

- [ ] **Step 1: 全量 tsc**

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor && pnpm -r tsc --noEmit 2>&1 | tail -30
```

Expected: 0 errors。注意 `apps/web` 用 `pnpm tsc -b` 而 `apps/api` 用 `pnpm tsc --noEmit`,所以脚本里要分别跑或单独跑:

```bash
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/api && pnpm tsc --noEmit
cd /Users/lplusm/Code/Self/Projects/fitness-instructor/apps/web && pnpm tsc -b
```

两条命令都 exit 0。

- [ ] **Step 2: 后端 API 手测**

假设 API 在 `http://localhost:3001`,BFF 在 `http://localhost:3000`,demo 用户 `13800138000` / `Test1234!`。

a) 登录获取 accessToken:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phonenumber":"13800138000","password":"Test1234!"}'
```

b) 用 token 调 list:

```bash
TOKEN=<上面返回的 accessToken>
curl -s http://localhost:3000/api/exercises -H "Authorization: Bearer $TOKEN" | head -c 600
```

Expected: 返回 4 条 seed 动作的 JSON,每条含 `targetMuscles:[{id,name}]`。

c) detail:

```bash
curl -s http://localhost:3000/api/exercises/<id> -H "Authorization: Bearer $TOKEN"
```

Expected: 单条完整记录,含 targetMuscles 数组。

d) 创建(选一个肌群 id,从前一步 list 任取):

```bash
curl -s -X POST http://localhost:3000/api/exercises \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"测试动作","category":1,"difficulty":1,"muscleGroupIds":["<mgId>"]}'
```

Expected: 返回 201 + 完整新动作。

e) 修改 + 删除(用上一步返回的 id):

```bash
curl -s -X PATCH http://localhost:3000/api/exercises/<newId> \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"difficulty":3}'
curl -s -X DELETE http://localhost:3000/api/exercises/<newId> -H "Authorization: Bearer $TOKEN"
```

Expected: PATCH 后 difficulty=3;DELETE 返回 `{ deleted: true }`。

f) 校验:

```bash
# 错误 category (7)
curl -s -X POST http://localhost:3000/api/exercises \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"x","category":7,"difficulty":1,"muscleGroupIds":["<mgId>"]}'
# 不存在 id
curl -s http://localhost:3000/api/exercises/nonexistent-id -H "Authorization: Bearer $TOKEN"
```

Expected: 前者返回 400(带 class-validator message),后者返回 404(NotFoundException)。

- [ ] **Step 3: CDP 走查 `/training/exercises`**

启动 dev server,打开浏览器到 `http://localhost:5173/training/exercises`:

1. 列表渲染 4 个种子动作(名称 + 难度徽章 + 分类/器械/目标肌群)。
2. 分类 chips 点击切换,列表过滤正确。
3. 搜索框输入「卧」,列表只剩「卧推」。
4. 点击「+ 添加动作」:填写名称 = "测试动作",分类 = 胸部,难度 = 初级,选 1 个肌群,保存 → 列表新增一条。
5. 点击新增的卡片 → 详情弹窗 → 点击「编辑」→ 表单弹窗(字段已预填)→ 改难度为高级 → 保存 → 详情中难度徽章变红。
6. 详情弹窗点「删除」→ `window.confirm` 确认 → 列表移除该条。
7. 切到「肌肉群管理」(`/training/muscle-groups`) → 不报错。
8. 登录态未失效 → 切到「概览/仪表盘」→ 不报错。

- [ ] **Step 4: 最终 commit(如有运行中的 patch)**

若 Step 2 / Step 3 中有补丁,一次性 commit:

```bash
git status
git add -p  # 或 git add <明确路径>
git commit -m "chore: 端到端验证补丁"
```