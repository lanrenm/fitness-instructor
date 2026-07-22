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