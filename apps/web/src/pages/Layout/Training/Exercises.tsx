/**
 * @description 训练管理 - 动作管理：搜索 + 分类筛选 + 动作列表 + 详情/表单弹窗
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
import type { IExercise } from '../../../services/exercisesService'

type FormState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; exercise: IExercise }

const ALL = 'all' as const
type CategoryFilter = typeof ALL | number

export default function TrainingExercises() {
  const { items, isLoading } = useExercises()
  const { create, update, remove } = useExerciseMutations()
  const { items: muscleGroupOptions } = useMuscleGroups()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>(ALL)
  const [detail, setDetail] = useState<IExercise | null>(null)
  const [form, setForm] = useState<FormState>({ open: false })

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return items.filter((it) => {
      if (category !== ALL && it.category !== category) return false
      if (kw && !it.name.toLowerCase().includes(kw)) return false
      return true
    })
  }, [items, search, category])

  const onDelete = async (exercise: IExercise) => {
    if (!window.confirm(`确认删除「${exercise.name}」？`)) return
    try {
      await remove.mutateAsync(exercise.id)
      setDetail(null)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败')
    }
  }

  const onSubmitForm: Parameters<typeof ExerciseFormDialog>[0]['onSubmit'] = async (values) => {
    if (form.open && form.mode === 'create') {
      await create.mutateAsync(values)
    } else if (form.open && form.mode === 'edit') {
      await update.mutateAsync({ id: form.exercise.id, input: values })
    }
    setForm({ open: false })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3748]">动作管理</h1>
          <p className="mt-1 text-sm text-[#718096]">管理和编辑训练动作库</p>
        </div>
        <button
          onClick={() => setForm({ open: true, mode: 'create' })}
          className="inline-flex items-center gap-1 rounded-xl bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(255,107,53,0.25)] hover:bg-[#E55A2B]"
        >
          <Plus size={14} /> 添加动作
        </button>
      </header>

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索动作名称..."
              className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2 pl-9 pr-3 text-sm text-[#2D3748] outline-none placeholder:text-[#A0AEC0] focus:border-[#FF6B35]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={category === ALL} onClick={() => setCategory(ALL)}>
              全部
            </Chip>
            {CATEGORY_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={category === o.value}
                onClick={() => setCategory(o.value)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {isLoading ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#F7FAFC]" />
              ))}
            </>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#718096]">
              {items.length === 0
                ? '还没有动作，点击右上角添加第一个。'
                : '没有匹配的动作，试试调整搜索或分类。'}
            </div>
          ) : (
            filtered.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onSelect={(e) => setDetail(e)}
              />
            ))
          )}
        </div>
      </section>

      {detail && (
        <ExerciseDetailDialog
          exercise={detail}
          onClose={() => setDetail(null)}
          onEdit={(e) => {
            setDetail(null)
            setForm({ open: true, mode: 'edit', exercise: e })
          }}
          onDelete={onDelete}
        />
      )}

      {form.open && (
        <ExerciseFormDialog
          open
          mode={form.mode}
          initial={form.mode === 'edit' ? form.exercise : undefined}
          muscleGroupOptions={muscleGroupOptions}
          onClose={() => setForm({ open: false })}
          onSubmit={onSubmitForm}
        />
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'bg-[#FF6B35] text-white'
          : 'bg-[#F7FAFC] text-[#4A5568] hover:bg-[#EDF2F7]')
      }
    >
      {children}
    </button>
  )
}