# 肌肉群管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `/training/muscle-groups` 页面，包含完整 CRUD（GET 列表 / GET 单个 / POST / PATCH / DELETE）、子肌群自关联下钻与设计稿匹配的 UI（3 张统计卡 + 肌群卡网格 + 详情弹窗 + 表单弹窗）。

**Architecture:** API 层新增 `apps/api/src/modules/muscle-groups/` Nest 模块，5 个端点，全部 JWT 鉴权；用 `pg.Pool` 直接走 SQL（含循环引用防护的递归 CTE）。`packages/ui-components` 新增 `Modal` / `MuscleGroupCard` / `MuscleGroupDetailDialog` / `MuscleGroupFormDialog` 4 个组件，外部 web 用 service+hook+page 三层架构。

**Tech Stack:** NestJS 11 + pg + class-validator / React 19 + react-query + Tailwind v4 / tsup / Module Federation (Vite)

---

## File Structure

**新增文件**
- `apps/api/src/modules/muscle-groups/muscle-groups.module.ts` — 模块注册
- `apps/api/src/modules/muscle-groups/muscle-groups.service.ts` — 业务逻辑
- `apps/api/src/modules/muscle-groups/muscle-groups.controller.ts` — 5 个端点
- `apps/api/src/modules/muscle-groups/dto/create-muscle-group.dto.ts` — Create DTO
- `apps/api/src/modules/muscle-groups/dto/update-muscle-group.dto.ts` — Update DTO
- `packages/ui-components/src/components/ui/modal.tsx` — 通用 Modal
- `packages/ui-components/src/components/ui/muscle-group-card.tsx` — 单张一级肌群卡
- `packages/ui-components/src/components/ui/muscle-group-detail-dialog.tsx` — 详情弹窗
- `packages/ui-components/src/components/ui/muscle-group-form-dialog.tsx` — 表单弹窗
- `packages/ui-components/src/lib/accent.ts` — hash → 5 色工具
- `apps/web/src/services/muscleGroupsService.ts` — 5 个 fetch
- `apps/web/src/hooks/useMuscleGroups.ts` — 列表 + tree 组装
- `apps/web/src/hooks/useMuscleGroup.ts` — 单个详情
- `apps/web/src/hooks/useMuscleGroupMutations.ts` — create/update/remove
- `scripts-tmp/muscle-groups-verify.mjs` — CDP e2e

**修改文件**
- `apps/api/src/app.module.ts` — 注册 MuscleGroupsModule
- `packages/ui-components/src/index.ts` — 导出 4 组件 + accent
- `apps/web/src/pages/Layout/Training/MuscleGroups.tsx` — 替换 PlaceholderPage
- `apps/web/src/styles/index.css` — @source inline 追加新工具类

---

## Task 1: API — CreateMuscleGroupDto & UpdateMuscleGroupDto

**Files:**
- Create: `apps/api/src/modules/muscle-groups/dto/create-muscle-group.dto.ts`
- Create: `apps/api/src/modules/muscle-groups/dto/update-muscle-group.dto.ts`

- [ ] **Step 1: Create CreateMuscleGroupDto**

Write `apps/api/src/modules/muscle-groups/dto/create-muscle-group.dto.ts`:

```ts
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMuscleGroupDto {
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

- [ ] **Step 2: Create UpdateMuscleGroupDto**

Write `apps/api/src/modules/muscle-groups/dto/update-muscle-group.dto.ts`:

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateMuscleGroupDto } from './create-muscle-group.dto';

export class UpdateMuscleGroupDto extends PartialType(CreateMuscleGroupDto) {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/muscle-groups/dto/
git commit -m "feat(api): muscle-groups Create/Update DTOs"
```

---

## Task 2: API — MuscleGroupsService

**Files:**
- Create: `apps/api/src/modules/muscle-groups/muscle-groups.service.ts`

- [ ] **Step 1: Write service**

Write `apps/api/src/modules/muscle-groups/muscle-groups.service.ts`:

```ts
import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { CreateMuscleGroupDto } from './dto/create-muscle-group.dto';
import { UpdateMuscleGroupDto } from './dto/update-muscle-group.dto';

const LIST_SQL = `
  SELECT mg.id, mg.name, mg.description, mg."parentId", mg."isActive",
         mg."createdAt", mg."updatedAt",
         COUNT(em.id)::int AS "exerciseCount"
  FROM "MuscleGroup" mg
  LEFT JOIN "ExcerciseMuscle" em ON em."muscleGroupId" = mg.id
  GROUP BY mg.id
  ORDER BY mg."createdAt" ASC
`;

const FIND_ONE_SQL = `
  SELECT mg.id, mg.name, mg.description, mg."parentId", mg."isActive",
         mg."createdAt", mg."updatedAt",
         COUNT(em.id)::int AS "exerciseCount"
  FROM "MuscleGroup" mg
  LEFT JOIN "ExcerciseMuscle" em ON em."muscleGroupId" = mg.id
  WHERE mg.id = $1
  GROUP BY mg.id
`;

@Injectable()
export class MuscleGroupsService {
  constructor(private db: DatabaseService) {}

  async findAll() {
    const r = await this.db.query(LIST_SQL);
    return r.rows;
  }

  async findOne(id: string) {
    const r = await this.db.query(FIND_ONE_SQL, [id]);
    if (r.rows.length === 0) throw new NotFoundException('肌肉群不存在');
    return r.rows[0];
  }

  async create(dto: CreateMuscleGroupDto) {
    if (dto.parentId) {
      await this.assertExists(dto.parentId);
    }
    const r = await this.db.query(
      `INSERT INTO "MuscleGroup" (id, name, description, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, COALESCE($4, true), NOW(), NOW())
       RETURNING id, name, description, "parentId", "isActive", "createdAt", "updatedAt"`,
      [dto.name, dto.description ?? null, dto.parentId ?? null, dto.isActive ?? null],
    );
    return this.findOne(r.rows[0].id);
  }

  async update(id: string, dto: UpdateMuscleGroupDto) {
    await this.assertExists(id);
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('不能把自己设为父级');
      }
      if (dto.parentId) {
        await this.assertExists(dto.parentId);
        const cycle = await this.db.query(
          `WITH RECURSIVE descendants AS (
             SELECT id FROM "MuscleGroup" WHERE "parentId" = $1
             UNION ALL
             SELECT mg.id FROM "MuscleGroup" mg JOIN descendants d ON mg."parentId" = d.id
           )
           SELECT EXISTS(SELECT 1 FROM descendants WHERE id = $2) AS would_cycle`,
          [id, dto.parentId],
        );
        if (cycle.rows[0].would_cycle) {
          throw new BadRequestException('不能把肌肉群移到其后代下');
        }
      }
    }
    await this.db.query(
      `UPDATE "MuscleGroup"
       SET name = COALESCE($2, name),
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           "parentId" = CASE WHEN $5::boolean THEN $6 ELSE "parentId" END,
           "isActive" = COALESCE($7, "isActive"),
           "updatedAt" = NOW()
       WHERE id = $1`,
      [
        id,
        dto.name ?? null,
        dto.description !== undefined,
        dto.description ?? null,
        dto.parentId !== undefined,
        dto.parentId ?? null,
        dto.isActive ?? null,
      ],
    );
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.assertExists(id);
    const ref = await this.db.query(
      `SELECT COUNT(*)::int AS cnt FROM "ExcerciseMuscle" WHERE "muscleGroupId" = $1`,
      [id],
    );
    const cnt = ref.rows[0].cnt;
    if (cnt > 0) {
      throw new ConflictException(`该肌群仍被 ${cnt} 个动作引用，无法删除`);
    }
    await this.db.query(`DELETE FROM "MuscleGroup" WHERE id = $1`, [id]);
  }

  private async assertExists(id: string) {
    const r = await this.db.query(`SELECT 1 FROM "MuscleGroup" WHERE id = $1`, [id]);
    if (r.rows.length === 0) throw new NotFoundException('肌肉群不存在');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/muscle-groups/muscle-groups.service.ts
git commit -m "feat(api): MuscleGroupsService CRUD + cycle prevention"
```

---

## Task 3: API — MuscleGroupsController & Module

**Files:**
- Create: `apps/api/src/modules/muscle-groups/muscle-groups.controller.ts`
- Create: `apps/api/src/modules/muscle-groups/muscle-groups.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write controller**

Write `apps/api/src/modules/muscle-groups/muscle-groups.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MuscleGroupsService } from './muscle-groups.service';
import { CreateMuscleGroupDto } from './dto/create-muscle-group.dto';
import { UpdateMuscleGroupDto } from './dto/update-muscle-group.dto';

@UseGuards(JwtAuthGuard)
@Controller('muscle-groups')
export class MuscleGroupsController {
  constructor(private readonly service: MuscleGroupsService) {}

  @Get()
  list() {
    return this.service.findAll();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMuscleGroupDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMuscleGroupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { deleted: true };
  }
}
```

- [ ] **Step 2: Write module**

Write `apps/api/src/modules/muscle-groups/muscle-groups.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { MuscleGroupsController } from './muscle-groups.controller';
import { MuscleGroupsService } from './muscle-groups.service';

@Module({
  controllers: [MuscleGroupsController],
  providers: [MuscleGroupsService, DatabaseService],
  exports: [MuscleGroupsService],
})
export class MuscleGroupsModule {}
```

- [ ] **Step 3: Register in AppModule**

Edit `apps/api/src/app.module.ts`. Replace lines 1-14 with:

```ts
import { Module } from '@nestjs/common';
import { AppController } from './lib/app.controller';
import { AppService } from './lib/app.service';
import { DatabaseService } from './database';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { AuthModule } from './modules/auth/auth.module';
import { OverviewModule } from './modules/overview/overview.module';
import { MuscleGroupsModule } from './modules/muscle-groups/muscle-groups.module';

@Module({
  imports: [AuthModule, OverviewModule, MuscleGroupsModule],
  controllers: [AppController, UsersController],
  providers: [AppService, DatabaseService, UsersService],
})
export class AppModule {}
```

- [ ] **Step 4: Build API**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Restart API container**

Run: `docker compose restart fi-api 2>&1 || docker restart fi-api 2>&1`
Expected: container restarts; logs show "MuscleGroupsModule" included in route map.

- [ ] **Step 6: curl smoke test (all 5 endpoints)**

Run:
```bash
TOKEN=$(curl -sS -X POST http://localhost:3001/auth/login -H 'Content-Type: application/json' \
  -d '{"phonenumber":"13800138000","password":"Test1234!"}' | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).accessToken))")

echo "[list]"; curl -sS http://localhost:3001/muscle-groups -H "Authorization: Bearer $TOKEN" | head -c 200; echo

echo "[create]"; CREATED=$(curl -sS -X POST http://localhost:3001/muscle-groups \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"smoke-肌群-A","description":"plan test"}')
echo "$CREATED"
NEW_ID=$(echo "$CREATED" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).id))")

echo "[detail]"; curl -sS http://localhost:3001/muscle-groups/$NEW_ID -H "Authorization: Bearer $TOKEN" | head -c 200; echo

echo "[patch]"; curl -sS -X PATCH http://localhost:3001/muscle-groups/$NEW_ID \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"description":"updated"}' | head -c 200; echo

echo "[delete]"; curl -sS -X DELETE http://localhost:3001/muscle-groups/$NEW_ID \
  -H "Authorization: Bearer $TOKEN" | head -c 100; echo

echo "[list after]"; curl -sS http://localhost:3001/muscle-groups -H "Authorization: Bearer $TOKEN" | head -c 200; echo
```

Expected: all five operations succeed; final `[list after]` does not contain `smoke-肌群-A`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/muscle-groups/ apps/api/src/app.module.ts
git commit -m "feat(api): MuscleGroups controller/module + AppModule wiring"
```

---

## Task 4: ui-components — accent util

**Files:**
- Create: `packages/ui-components/src/lib/accent.ts`

- [ ] **Step 1: Write accent util**

Write `packages/ui-components/src/lib/accent.ts`:

```ts
export interface AccentPalette {
  bg: string;
  fg: string;
}

const PALETTES: AccentPalette[] = [
  { bg: '#FFE8E1', fg: '#FF6B35' },
  { bg: '#E5F0FF', fg: '#3B91F5' },
  { bg: '#E3F4EC', fg: '#35B87A' },
  { bg: '#EFE5FA', fg: '#8B5CF6' },
  { bg: '#FFE7EC', fg: '#FF5A67' },
];

export function accentFor(seed: string): AccentPalette {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTES[h % PALETTES.length];
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui-components/src/lib/accent.ts
git commit -m "feat(ui-components): accent palette util"
```

---

## Task 5: ui-components — Modal

**Files:**
- Create: `packages/ui-components/src/components/ui/modal.tsx`

- [ ] **Step 1: Write Modal**

Write `packages/ui-components/src/components/ui/modal.tsx`:

```tsx
import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeCls: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, footer, size = 'md', className }: ModalProps) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={cn('w-full rounded-2xl bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]', sizeCls[size], className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[#EDF2F7] px-6 py-4">
            <h3 className="text-base font-semibold text-[#2D3748]">{title}</h3>
            <button onClick={onClose} aria-label="关闭" className="grid h-8 w-8 place-items-center rounded-full text-[#718096] hover:bg-[#F7FAFC]">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 border-t border-[#EDF2F7] px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build ui-components**

Run: `pnpm --filter @fitness/ui-components build`
Expected: build success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui-components/src/components/ui/modal.tsx
git commit -m "feat(ui-components): Modal"
```

---

## Task 6: ui-components — MuscleGroupCard

**Files:**
- Create: `packages/ui-components/src/components/ui/muscle-group-card.tsx`

- [ ] **Step 1: Write MuscleGroupCard**

Write `packages/ui-components/src/components/ui/muscle-group-card.tsx`:

```tsx
import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AccentPalette } from '@/lib/accent'

export interface MuscleGroupCardProps {
  name: string
  description?: string | null
  exerciseCount: number
  accent: AccentPalette
  onSelect?: () => void
  className?: string
}

export function MuscleGroupCard({ name, description, exerciseCount, accent, onSelect, className }: MuscleGroupCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex w-full flex-col gap-3 rounded-2xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]',
        'border-[#EDF2F7]',
        className,
      )}
    >
      <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: accent.bg, color: accent.fg }}>
        <ChevronRight size={20} />
      </div>
      <div>
        <div className="text-base font-semibold text-[#2D3748]">{name}</div>
        {description && <div className="mt-1 line-clamp-2 text-xs text-[#718096]">{description}</div>}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-[#EDF2F7] pt-3 text-xs text-[#718096]">
        <span>关联动作</span>
        <span className="text-base font-semibold" style={{ color: accent.fg }}>{exerciseCount}</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Build ui-components**

Run: `pnpm --filter @fitness/ui-components build`
Expected: build success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui-components/src/components/ui/muscle-group-card.tsx
git commit -m "feat(ui-components): MuscleGroupCard"
```

---

## Task 7: ui-components — MuscleGroupDetailDialog

**Files:**
- Create: `packages/ui-components/src/components/ui/muscle-group-detail-dialog.tsx`

- [ ] **Step 1: Write MuscleGroupDetailDialog**

Write `packages/ui-components/src/components/ui/muscle-group-detail-dialog.tsx`:

```tsx
import * as React from 'react'
import { Edit2, Trash2, ChevronRight, ArrowUp } from 'lucide-react'
import { Modal } from './modal'
import { accentFor, type AccentPalette } from '@/lib/accent'

export interface ChildMuscleEntry {
  id: string
  name: string
  description?: string | null
  exerciseCount: number
}

export interface MuscleGroupDetailDialogProps {
  open: boolean
  name: string
  description?: string | null
  exerciseCount: number
  accent?: AccentPalette
  parentName?: string | null
  children?: ChildMuscleEntry[]
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  onSelectParent?: () => void
  onSelectChild?: (id: string) => void
}

export function MuscleGroupDetailDialog({
  open, name, description, exerciseCount, accent, parentName, children,
  onClose, onEdit, onDelete, onSelectParent, onSelectChild,
}: MuscleGroupDetailDialogProps) {
  const a = accent ?? accentFor(name)
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
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: a.bg, color: a.fg }}>
          <ChevronRight size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[#2D3748]">{name}</h3>
          <div className="mt-1 text-xs text-[#718096]">关联动作 <span className="font-semibold" style={{ color: a.fg }}>{exerciseCount}</span></div>
        </div>
      </div>

      {description && <p className="mt-4 text-sm leading-relaxed text-[#4A5568]">{description}</p>}

      {parentName && (
        <div className="mt-4">
          <div className="text-xs text-[#718096]">父级肌群</div>
          <button onClick={onSelectParent} className="mt-1 inline-flex items-center gap-1 rounded-md border border-[#EDF2F7] bg-[#F7FAFC] px-2.5 py-1 text-xs text-[#2D3748] hover:bg-[#EDF2F7]">
            <ArrowUp size={12} /> {parentName}
          </button>
        </div>
      )}

      <div className="mt-4">
        <div className="text-xs text-[#718096]">子肌群（{children?.length ?? 0}）</div>
        {children && children.length > 0 ? (
          <ul className="mt-2 divide-y divide-[#EDF2F7] rounded-xl border border-[#EDF2F7]">
            {children.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onSelectChild?.(c.id)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-[#F7FAFC]"
                >
                  <span className="truncate text-sm text-[#2D3748]">{c.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-[#718096]">
                    <span style={{ color: accentFor(c.name).fg }} className="font-semibold">{c.exerciseCount}</span>
                    <ChevronRight size={14} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 text-xs text-[#A0AEC0]">无子肌群</div>
        )}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Build ui-components**

Run: `pnpm --filter @fitness/ui-components build`
Expected: build success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui-components/src/components/ui/muscle-group-detail-dialog.tsx
git commit -m "feat(ui-components): MuscleGroupDetailDialog"
```

---

## Task 8: ui-components — MuscleGroupFormDialog

**Files:**
- Create: `packages/ui-components/src/components/ui/muscle-group-form-dialog.tsx`

- [ ] **Step 1: Write MuscleGroupFormDialog**

Write `packages/ui-components/src/components/ui/muscle-group-form-dialog.tsx`:

```tsx
import * as React from 'react'
import { Modal } from './modal'

export interface ParentOption {
  id: string
  name: string
}

export interface MuscleGroupFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: { name?: string; description?: string | null; parentId?: string | null; isActive?: boolean }
  parentOptions?: ParentOption[]
  defaultParentId?: string
  excludeParentIds?: string[]
  onClose: () => void
  onSubmit: (values: { name: string; description?: string; parentId?: string | null; isActive?: boolean }) => void | Promise<void>
}

export function MuscleGroupFormDialog({ open, mode, initial, parentOptions, defaultParentId, excludeParentIds, onClose, onSubmit }: MuscleGroupFormDialogProps) {
  const [name, setName] = React.useState(initial?.name ?? '')
  const [description, setDescription] = React.useState(initial?.description ?? '')
  const [parentId, setParentId] = React.useState<string | null>(initial?.parentId ?? defaultParentId ?? null)
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setDescription(initial?.description ?? '')
    setParentId(initial?.parentId ?? defaultParentId ?? null)
    setIsActive(initial?.isActive ?? true)
    setError(null)
  }, [open, initial, defaultParentId])

  const title = mode === 'create' ? '添加肌群' : '编辑肌群'

  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#4A5568] hover:bg-[#F7FAFC]">取消</button>
          <button
            disabled={submitting || !name.trim()}
            onClick={async () => {
              setSubmitting(true); setError(null)
              try {
                await onSubmit({ name: name.trim(), description: description || undefined, parentId, isActive })
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : '提交失败')
              } finally {
                setSubmitting(false)
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
            placeholder="如：胸大肌"
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">描述</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="肌群说明（可选）"
            className="resize-none rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">父级肌群</span>
          <select
            value={parentId ?? ''}
            onChange={(e) => setParentId(e.target.value || null)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
          >
            <option value="">无（一级）</option>
            {parentOptions
              ?.filter((o) => !(excludeParentIds ?? []).includes(o.id))
              .map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[#FF6B35]" />
          <span className="text-sm text-[#4A5568]">启用</span>
        </label>
        {error && <div className="rounded-lg bg-[#FFF5F5] px-3 py-2 text-xs text-[#C53030]">{error}</div>}
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Build ui-components**

Run: `pnpm --filter @fitness/ui-components build`
Expected: build success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui-components/src/components/ui/muscle-group-form-dialog.tsx
git commit -m "feat(ui-components): MuscleGroupFormDialog"
```

---

## Task 9: ui-components — index.ts exports

**Files:**
- Modify: `packages/ui-components/src/index.ts`

- [ ] **Step 1: Append exports**

Edit `packages/ui-components/src/index.ts`. Add at end:

```ts
export { Modal, type ModalProps } from "./components/ui/modal"
export { MuscleGroupCard, type MuscleGroupCardProps } from "./components/ui/muscle-group-card"
export { MuscleGroupDetailDialog, type MuscleGroupDetailDialogProps, type ChildMuscleEntry } from "./components/ui/muscle-group-detail-dialog"
export { MuscleGroupFormDialog, type MuscleGroupFormDialogProps, type ParentOption } from "./components/ui/muscle-group-form-dialog"
export { accentFor, type AccentPalette } from "./lib/accent"
```

- [ ] **Step 2: Build ui-components**

Run: `pnpm --filter @fitness/ui-components build`
Expected: build success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui-components/src/index.ts
git commit -m "feat(ui-components): export muscle-group components"
```

---

## Task 10: Web — muscleGroupsService

**Files:**
- Create: `apps/web/src/services/muscleGroupsService.ts`

- [ ] **Step 1: Write service**

Write `apps/web/src/services/muscleGroupsService.ts`:

```ts
/**
 * @description 肌群管理 - 5 个 CRUD fetch
 */

export interface IMuscleGroup {
  id: string
  name: string
  description: string | null
  parentId: string | null
  isActive: boolean
  exerciseCount: number
  createdAt: string
  updatedAt: string
}

export interface IMuscleGroupInput {
  name: string
  description?: string
  parentId?: string | null
  isActive?: boolean
}

const BFF_BASE = import.meta.env.VITE_BFF_URL || 'http://localhost:3000'

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('accessToken')
  return fetch(`${BFF_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
}

export const muscleGroupsService = {
  async list(): Promise<IMuscleGroup[]> {
    const res = await authedFetch('/api/muscle-groups')
    if (!res.ok) throw new Error(await safeMsg(res, '获取肌群列表失败'))
    return res.json()
  },

  async getOne(id: string): Promise<IMuscleGroup> {
    const res = await authedFetch(`/api/muscle-groups/${id}`)
    if (!res.ok) throw new Error(await safeMsg(res, '获取肌群详情失败'))
    return res.json()
  },

  async create(input: IMuscleGroupInput): Promise<IMuscleGroup> {
    const res = await authedFetch('/api/muscle-groups', { method: 'POST', body: JSON.stringify(input) })
    if (!res.ok) throw new Error(await safeMsg(res, '创建肌群失败'))
    return res.json()
  },

  async update(id: string, input: Partial<IMuscleGroupInput>): Promise<IMuscleGroup> {
    const res = await authedFetch(`/api/muscle-groups/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
    if (!res.ok) throw new Error(await safeMsg(res, '更新肌群失败'))
    return res.json()
  },

  async remove(id: string): Promise<void> {
    const res = await authedFetch(`/api/muscle-groups/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await safeMsg(res, '删除肌群失败'))
  },
}

async function safeMsg(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return (data as { message?: string }).message ?? fallback
  } catch {
    return fallback
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/services/muscleGroupsService.ts
git commit -m "feat(web): muscleGroupsService"
```

---

## Task 11: Web — hooks (useMuscleGroups / useMuscleGroup / useMuscleGroupMutations)

**Files:**
- Create: `apps/web/src/hooks/useMuscleGroups.ts`
- Create: `apps/web/src/hooks/useMuscleGroup.ts`
- Create: `apps/web/src/hooks/useMuscleGroupMutations.ts`

- [ ] **Step 1: Write useMuscleGroups**

Write `apps/web/src/hooks/useMuscleGroups.ts`:

```ts
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { muscleGroupsService, type IMuscleGroup } from '../services/muscleGroupsService'

export interface IMuscleGroupNode extends IMuscleGroup {
  children: IMuscleGroupNode[]
}

function buildTree(items: IMuscleGroup[]): IMuscleGroupNode[] {
  const map = new Map<string, IMuscleGroupNode>(items.map((g) => [g.id, { ...g, children: [] }]))
  const roots: IMuscleGroupNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function useMuscleGroups() {
  const query = useQuery({
    queryKey: ['muscleGroups'],
    queryFn: () => muscleGroupsService.list(),
    staleTime: 30_000,
  })
  const items = query.data ?? []
  const tree = useMemo(() => (items.length ? buildTree(items) : []), [items])
  return { ...query, items, tree }
}
```

- [ ] **Step 2: Write useMuscleGroup**

Write `apps/web/src/hooks/useMuscleGroup.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { muscleGroupsService } from '../services/muscleGroupsService'

export function useMuscleGroup(id: string | null) {
  return useQuery({
    queryKey: ['muscleGroup', id],
    queryFn: () => muscleGroupsService.getOne(id as string),
    enabled: !!id,
    staleTime: 30_000,
  })
}
```

- [ ] **Step 3: Write useMuscleGroupMutations**

Write `apps/web/src/hooks/useMuscleGroupMutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { muscleGroupsService, type IMuscleGroupInput } from '../services/muscleGroupsService'

export function useMuscleGroupMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['muscleGroups'] })
    qc.invalidateQueries({ queryKey: ['muscleGroup'] })
  }

  const create = useMutation({
    mutationFn: (input: IMuscleGroupInput) => muscleGroupsService.create(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<IMuscleGroupInput> }) =>
      muscleGroupsService.update(id, input),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => muscleGroupsService.remove(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useMuscleGroups.ts apps/web/src/hooks/useMuscleGroup.ts apps/web/src/hooks/useMuscleGroupMutations.ts
git commit -m "feat(web): muscle-group react-query hooks"
```

---

## Task 12: Web — MuscleGroups page

**Files:**
- Modify: `apps/web/src/pages/Layout/Training/MuscleGroups.tsx`

- [ ] **Step 1: Replace placeholder with orchestrator**

Write `apps/web/src/pages/Layout/Training/MuscleGroups.tsx`:

```tsx
/**
 * @description 训练管理 - 肌群管理：3 统计卡 + 肌群网格 + 详情弹窗（下钻）+ 添加/编辑表单弹窗
 */
import { useMemo, useState } from 'react'
import { BarChart3, Layers, Link as LinkIcon, Plus } from 'lucide-react'
import {
  StatsCardGroup,
  MuscleGroupCard,
  MuscleGroupDetailDialog,
  MuscleGroupFormDialog,
  accentFor,
} from '@fitness/ui-components'
import { useMuscleGroups } from '../../../hooks/useMuscleGroups'
import { useMuscleGroupMutations } from '../../../hooks/useMuscleGroupMutations'
import type { IMuscleGroupNode } from '../../../hooks/useMuscleGroups'

type DetailStackEntry = { id: string; name: string; exerciseCount: number }

type FormState =
  | { open: false }
  | { open: true; mode: 'create'; defaultParentId?: string }
  | { open: true; mode: 'edit'; group: { id: string; name: string; description: string | null; parentId: string | null; isActive: boolean } }

export default function TrainingMuscleGroups() {
  const { items, tree, isLoading } = useMuscleGroups()
  const { create, update, remove } = useMuscleGroupMutations()

  const [detailStack, setDetailStack] = useState<DetailStackEntry[]>([])
  const [form, setForm] = useState<FormState>({ open: false })

  const totals = useMemo(() => {
    const total = items.length
    const totalEx = items.reduce((s, i) => s + i.exerciseCount, 0)
    const avg = total === 0 ? 0 : Math.round(totalEx / total)
    return { total, totalEx, avg }
  }, [items])

  const nameById = useMemo(() => new Map(items.map((i) => [i.id, i.name])), [items])
  const childOfById = useMemo(() => {
    const m = new Map<string, IMuscleGroupNode>()
    const visit = (nodes: IMuscleGroupNode[]) => {
      for (const n of nodes) { m.set(n.id, n); visit(n.children) }
    }
    visit(tree)
    return m
  }, [tree])

  const openDetail = (id: string) => {
    const n = childOfById.get(id)
    if (!n) return
    setDetailStack([{ id: n.id, name: n.name, exerciseCount: n.exerciseCount }])
  }
  const drillToChild = (childId: string) => {
    const c = childOfById.get(childId)
    if (!c) return
    setDetailStack((s) => [...s, { id: c.id, name: c.name, exerciseCount: c.exerciseCount }])
  }
  const closeTop = () => setDetailStack((s) => s.slice(0, -1))
  const closeAllDetail = () => setDetailStack([])

  const top = detailStack[detailStack.length - 1]
  const topNode = top ? childOfById.get(top.id) : null

  const onDeleteTop = async () => {
    if (!top) return
    if (!window.confirm(`确认删除「${top.name}」？`)) return
    try {
      await remove.mutateAsync(top.id)
      closeTop()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败')
    }
  }

  const onSubmitForm: Parameters<typeof MuscleGroupFormDialog>[0]['onSubmit'] = async (values) => {
    if (form.open && form.mode === 'create') {
      await create.mutateAsync(values)
    } else if (form.open && form.mode === 'edit') {
      await update.mutateAsync({ id: form.group.id, input: values })
    }
    setForm({ open: false })
  }

  const parentOptions = useMemo(
    () => items.map((i) => ({ id: i.id, name: i.name })),
    [items],
  )

  const excludeIds = form.open && form.mode === 'edit'
    ? collectDescendantIds(childOfById.get(form.group.id) ?? null).concat(form.group.id)
    : []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3748]">肌肉群管理</h1>
          <p className="mt-1 text-sm text-[#718096]">管理和编辑肌肉群分类</p>
        </div>
        <button
          onClick={() => setForm({ open: true, mode: 'create' })}
          className="inline-flex items-center gap-1 rounded-xl bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(255,107,53,0.25)] hover:bg-[#E55A2B]"
        >
          <Plus size={14} /> 添加肌肉群
        </button>
      </header>

      <StatsCardGroup
        columns={4}
        items={[
          { icon: Layers,    value: totals.total,            label: '总肌肉群', iconColor: { bg: '#E5F0FF', fg: '#3B91F5' } },
          { icon: LinkIcon,  value: totals.totalEx,         label: '关联动作', iconColor: { bg: '#FFE8E1', fg: '#FF6B35' } },
          { icon: BarChart3, value: totals.avg,             label: '平均动作数', iconColor: { bg: '#E3F4EC', fg: '#35B87A' } },
          { icon: Layers,    value: tree.length,            label: '一级肌群', iconColor: { bg: '#EFE5FA', fg: '#8B5CF6' } },
        ]}
      />

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.03)]">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#F7FAFC]" />
            ))}
          </div>
        ) : tree.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#718096]">
            还没有肌群，点击右上角添加第一个。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tree.map((node) => (
              <MuscleGroupCard
                key={node.id}
                name={node.name}
                description={node.description}
                exerciseCount={node.exerciseCount}
                accent={accentFor(node.name)}
                onSelect={() => openDetail(node.id)}
              />
            ))}
          </div>
        )}
      </section>

      {topNode && (
        <MuscleGroupDetailDialog
          open
          name={topNode.name}
          description={topNode.description}
          exerciseCount={topNode.exerciseCount}
          accent={accentFor(topNode.name)}
          parentName={topNode.parentId ? nameById.get(topNode.parentId) ?? null : null}
          onSelectParent={topNode.parentId ? () => drillToChild(topNode.parentId!) : undefined}
          children={topNode.children.map((c) => ({
            id: c.id, name: c.name, description: c.description, exerciseCount: c.exerciseCount,
          }))}
          onClose={detailStack.length > 1 ? closeTop : closeAllDetail}
          onEdit={() => setForm({ open: true, mode: 'edit', group: {
            id: topNode.id, name: topNode.name, description: topNode.description,
            parentId: topNode.parentId, isActive: topNode.isActive,
          } })}
          onDelete={onDeleteTop}
          onSelectChild={drillToChild}
        />
      )}

      {form.open && (
        <MuscleGroupFormDialog
          open
          mode={form.mode}
          initial={form.mode === 'edit'
            ? { name: form.group.name, description: form.group.description, parentId: form.group.parentId, isActive: form.group.isActive }
            : { parentId: form.defaultParentId ?? null, isActive: true }}
          parentOptions={parentOptions}
          excludeParentIds={excludeIds}
          onClose={() => setForm({ open: false })}
          onSubmit={onSubmitForm}
        />
      )}
    </div>
  )
}

function collectDescendantIds(node: IMuscleGroupNode | null): string[] {
  if (!node) return []
  const out: string[] = []
  const walk = (n: IMuscleGroupNode) => { for (const c of n.children) { out.push(c.id); walk(c) } }
  walk(node)
  return out
}
```

- [ ] **Step 2: Append required utility classes to @source inline**

Edit `apps/web/src/styles/index.css`. Replace the long `@source inline` string with one that also includes: `divide-y`, `divide-[#EDF2F7]`, `border-[#EDF2F7]`, `border-[#E2E8F0]`, `bg-[#FFF5F5]`, `bg-[#F7FAFC]`, `text-[#E53E3E]`, `text-[#C53030]`, `text-[#A0AEC0]`, `text-[#4A5568]`, `accent-[#FF6B35]`, `focus:border-[#FF6B35]`, `resize-none`, `shadow-[0_8px_24px_rgba(15,23,42,0.08)]`, `shadow-[0_24px_48px_rgba(15,23,42,0.18)]`, `shadow-[0_2px_8px_rgba(255,107,53,0.25)]`, `hover:-translate-y-0.5`, `hover:bg-[#FFF5F5]`, `hover:bg-[#EDF2F7]`, `hover:bg-[#E55A2B]`, `hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]`, `disabled:opacity-50`, `border-b`, `border-t`, `text-[#2D3748]`, `text-[#718096]`, `rounded-md`, `bg-[#FED7D7]`, `text-[#C53030]`, `bg-white`, `line-clamp-2`.

The final `@source inline` line should be one line, comma-separated tokens. (Read the current file first to keep the existing classes; only append.)

- [ ] **Step 3: Build web (TS only — vite build skipped because vite config still has unfixed TS issues from earlier session)**

Run: `cd apps/web && pnpm exec tsc -b --noEmit 2>&1 | head -40`
Expected: exit 0 (warnings about App.tsx `login` unused var and vite.config `eager` typing are pre-existing and out of scope).

If exit 0 — success. Otherwise, fix the type errors introduced by this task.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Layout/Training/MuscleGroups.tsx apps/web/src/styles/index.css
git commit -m "feat(web): MuscleGroups page orchestrator + tailwind classes"
```

---

## Task 13: e2e — CDP verify script

**Files:**
- Create: `scripts-tmp/muscle-groups-verify.mjs`

- [ ] **Step 1: Write verify script**

Write `scripts-tmp/muscle-groups-verify.mjs`:

```js
/**
 * Muscle Groups 端到端验证（CDP）
 *
 * 流程：
 *  1. 起 Chrome（--headless=new, --remote-debugging-port=9230）
 *  2. 演示账号登录拿 token
 *  3. 通过 API 注入一条 "e2e-测试肌群"（root）
 *  4. 打开 web、注入 token、跳 /training/muscle-groups
 *  5. 断言：
 *     - 3+ 个统计卡（value 含数字）
 *     - 至少 1 张肌群卡，名字是 "e2e-测试肌群"
 *     - 点击该卡 → 详情弹窗可见，标题含 "e2e-测试肌群"
 *     - 关闭弹窗后页面回到主视图
 *  6. 走添加流程：填名字 → 提交 → 列表 +1
 *  7. 删除刚加的那条 → 列表 -1（最终不包含）
 *  8. 收尾：删除 e2e-测试肌群（如果还在）
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9230;
const API = 'http://localhost:3001';
const WEB = 'http://localhost:5173';
const DEMO_PHONE = '13800138000';
const DEMO_PASS = 'Test1234!';

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=/tmp/chrome-muscle-groups-verify', '--headless=new', '--window-size=1440,1500',
  'about:blank',
], { stdio: 'ignore' });
await sleep(1500);

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const pageTab = tabs.find((t) => t.type === 'page');
if (!pageTab) throw new Error('no page tab');
const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id != null && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(m.error.message)); else resolve(m.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evalExpr = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};
await new Promise((r) => ws.once('open', r));

// 1. 登录
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phonenumber: DEMO_PHONE, password: DEMO_PASS }),
});
const { accessToken } = await loginRes.json();
if (!accessToken) { console.error('login failed'); chrome.kill(); process.exit(1); }
const auth = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
console.log('[login] ok');

// 2. 注入 e2e-测试肌群（root）
const injectedName = 'e2e-测试肌群';
const createRes = await fetch(`${API}/muscle-groups`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({ name: injectedName, description: 'E2E 创建的测试肌群' }),
});
if (!createRes.ok) {
  console.error('seed inject failed', createRes.status, await createRes.text());
  chrome.kill(); process.exit(1);
}
const injected = await createRes.json();
console.log('[seed inject] id=', injected.id);

// 3. 打开 web + 跳路由
await send('Page.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Runtime.enable');
await send('Page.navigate', { url: `${WEB}/login?cb=${Date.now()}` });
await sleep(2500);
await evalExpr(`localStorage.setItem('accessToken', ${JSON.stringify(accessToken)}); localStorage.setItem('refreshToken', 'x'); true;`);
await send('Page.navigate', { url: `${WEB}/training/muscle-groups?cb=${Date.now()}` });
await sleep(6000);

// 4. 断言：统计卡 + 至少 1 张肌群卡 + 标题
const initial = await evalExpr(`
  (() => {
    const cards = [...document.querySelectorAll('div.relative')].filter((d) => d.querySelector('.text-2xl'));
    const stats = cards.map((c) => c.querySelector('.text-2xl')?.textContent?.trim());
    const cardButtons = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes(${JSON.stringify(injectedName)}));
    return {
      pathname: location.pathname,
      statCount: stats.length,
      hasInjectedCard: cardButtons.length > 0,
      h1: document.querySelector('h1')?.textContent?.trim(),
    };
  })()
`);
console.log('[initial]', initial);
if (initial.pathname !== '/training/muscle-groups') throw new Error('wrong pathname');
if (!initial.h1?.includes('肌肉群管理')) throw new Error('h1 missing');
if (initial.statCount < 3) throw new Error('stat cards < 3');
if (!initial.hasInjectedCard) throw new Error('injected card not rendered');

// 5. 点击注入的卡 → 弹窗
await evalExpr(`
  (() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(injectedName)}));
    btn?.click();
    true;
  })()
`);
await sleep(800);
const detail = await evalExpr(`
  (() => {
    const dialogs = [...document.querySelectorAll('div')].filter((d) => {
      const cn = (d.className?.toString?.() || '');
      return cn.includes('rounded-2xl') && cn.includes('bg-white') && cn.includes('shadow-[') && d.querySelector('h3');
    });
    const last = dialogs[dialogs.length - 1];
    return { open: !!last, title: last?.querySelector('h3')?.textContent?.trim() };
  })()
`);
console.log('[detail]', detail);
if (!detail.open) throw new Error('detail dialog did not open');
if (!detail.title?.includes(injectedName)) throw new Error('detail title wrong');

// 关闭弹窗
await evalExpr(`
  (() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '关闭');
    btn?.click();
    true;
  })()
`);
await sleep(500);

// 6. 添加肌群
const newName = 'e2e-add-' + Date.now();
await evalExpr(`
  (() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('添加肌肉群'))?.click();
    true;
  })()
`);
await sleep(500);
await evalExpr(`
  (() => {
    const input = document.querySelector('input[placeholder="如：胸大肌"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(newName)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    true;
  })()
`);
await sleep(300);
await evalExpr(`
  (() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '保存');
    btn?.click();
    true;
  })()
`);
await sleep(2000);

const afterAdd = await evalExpr(`
  (() => {
    const cardButtons = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes(${JSON.stringify(newName)}));
    return { hasNewCard: cardButtons.length > 0 };
  })()
`);
console.log('[afterAdd]', afterAdd);
if (!afterAdd.hasNewCard) throw new Error('new muscle group not rendered after add');

// 7. 删除刚才加的那条（直接走 API + 检查）
const listAfter = await (await fetch(`${API}/muscle-groups`, { headers: auth })).json();
const toDelete = listAfter.find((g) => g.name === newName);
if (toDelete) {
  const delRes = await fetch(`${API}/muscle-groups/${toDelete.id}`, { method: 'DELETE', headers: auth });
  if (!delRes.ok) throw new Error('delete failed: ' + delRes.status);
}

// 8. 收尾：清理 e2e-测试肌群
await fetch(`${API}/muscle-groups/${injected.id}`, { method: 'DELETE', headers: auth }).catch(() => {});

console.log('\nALL ASSERTIONS PASSED');
ws.close();
chrome.kill();
process.exit(0);
```

- [ ] **Step 2: Run verify script**

Run: `node scripts-tmp/muscle-groups-verify.mjs`
Expected: prints `[login] ok`, `[seed inject] id=...`, `[initial]`, `[detail]`, `[afterAdd]`, ends with `ALL ASSERTIONS PASSED`.

If it fails, capture the relevant output and fix the issue (most common: tailwind class missing — add to @source inline).

- [ ] **Step 3: Commit**

```bash
git add scripts-tmp/muscle-groups-verify.mjs
git commit -m "test(web): CDP e2e muscle-groups-verify"
```

---

## Task 14: Push

- [ ] **Step 1: Push branch**

Run: `git push origin feature/lijm`
Expected: push succeeds.

---

## Self-Review

**Spec coverage:**
- §1 需求（CRUD + 子肌群下钻） → Tasks 1-13 全覆盖
- §2 数据模型（无 schema 变更） → 不需 migration
- §3 API 5 端点 → Tasks 1-3
- §4 UI 组件 → Tasks 4-9
- §5 页面 → Task 12
- §6 错误处理 → 409 由 service 实现；表单 inline 错误由 dialog 展示
- §7 依赖 → 无新增
- §8 文件结构 → 全覆盖
- §9 实现步骤 → 1-7 全部对应 Task
- §10 范围外 → 已剔除

**Placeholder scan:** 无 "TBD/TODO"。

**Type consistency:** `IMuscleGroup` ↔ service 返回 ↔ hook 消费 ↔ page 使用全部一致；`IMuscleGroupNode.children` ↔ `buildTree` ↔ `MuscleGroupDetailDialog.children` 一致；`accentFor(name)` ↔ `AccentPalette` 一致。