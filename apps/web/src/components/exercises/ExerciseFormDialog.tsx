import * as React from 'react'
import { X } from 'lucide-react'
import { Modal } from '@fitness/ui-components'
import type { IExercise, IExerciseInput } from '../../services/exercisesService'
import type { IMuscleGroup } from '../../services/muscleGroupsService'
import { CATEGORY_OPTIONS, DIFFICULTY_OPTIONS } from './constants'

export interface ExerciseFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: Partial<IExercise>
  muscleGroupOptions: IMuscleGroup[]
  onClose: () => void
  onSubmit: (values: IExerciseInput) => void | Promise<void>
}

const DEFAULT_CATEGORY = CATEGORY_OPTIONS[0]?.value ?? 1
const DEFAULT_DIFFICULTY = DIFFICULTY_OPTIONS[0]?.value ?? 1

export function ExerciseFormDialog({ open, mode, initial, muscleGroupOptions, onClose, onSubmit }: ExerciseFormDialogProps) {
  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState<number>(DEFAULT_CATEGORY)
  const [difficulty, setDifficulty] = React.useState<number>(DEFAULT_DIFFICULTY)
  const [equipment, setEquipment] = React.useState<string[]>([])
  const [equipmentInput, setEquipmentInput] = React.useState('')
  const [muscleIds, setMuscleIds] = React.useState<string[]>([])
  const [description, setDescription] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setCategory(initial?.category ?? DEFAULT_CATEGORY)
    setDifficulty(initial?.difficulty ?? DEFAULT_DIFFICULTY)
    setEquipment(initial?.equipment ?? [])
    setEquipmentInput('')
    setMuscleIds((initial?.targetMuscles ?? []).map((m) => m.id))
    setDescription(initial?.description ?? '')
    setError(null)
  }, [open, initial])

  const title = mode === 'create' ? '添加动作' : '编辑动作'
  const submitLabel = mode === 'create' ? '创建' : '保存'

  const addEquipment = () => {
    const value = equipmentInput.trim().replace(/,$/, '').trim()
    if (!value) return
    setEquipment((prev) => (prev.includes(value) ? prev : [...prev, value]))
    setEquipmentInput('')
  }

  const removeEquipment = (value: string) => {
    setEquipment((prev) => prev.filter((e) => e !== value))
  }

  const toggleMuscle = (id: string) => {
    setMuscleIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('请填写动作名称')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        difficulty,
        equipment,
        muscleGroupIds: muscleIds,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#4A5568] hover:bg-[#F7FAFC]">取消</button>
          <button
            disabled={submitting || !name.trim()}
            onClick={handleSubmit}
            className="rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white hover:bg-[#E55A2B] disabled:opacity-50"
          >
            {submitting ? '提交中…' : submitLabel}
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
            placeholder="如：卧推"
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">器械</span>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 focus-within:border-[#FF6B35]">
            {equipment.map((item) => (
              <span key={item} className="inline-flex items-center gap-1 rounded-md bg-[#FFE8E1] px-2 py-0.5 text-xs text-[#FF6B35]">
                {item}
                <button
                  type="button"
                  onClick={() => removeEquipment(item)}
                  aria-label={`移除${item}`}
                  className="grid h-4 w-4 place-items-center rounded-full text-[#FF6B35] hover:bg-[#FFD6C7]"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <input
              value={equipmentInput}
              onChange={(e) => setEquipmentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addEquipment()
                } else if (e.key === 'Backspace' && !equipmentInput && equipment.length > 0) {
                  removeEquipment(equipment[equipment.length - 1])
                }
              }}
              onBlur={addEquipment}
              placeholder={equipment.length === 0 ? '输入后回车或逗号添加' : ''}
              className="min-w-[8rem] flex-1 border-none bg-transparent text-sm text-[#2D3748] outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">目标肌群</span>
          {muscleGroupOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {muscleGroupOptions.map((mg) => {
                const selected = muscleIds.includes(mg.id)
                return (
                  <button
                    key={mg.id}
                    type="button"
                    onClick={() => toggleMuscle(mg.id)}
                    aria-pressed={selected}
                    className={
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                      (selected
                        ? 'border-[#FF6B35] bg-[#FF6B35] text-white'
                        : 'border-[#E2E8F0] bg-white text-[#4A5568] hover:border-[#FF6B35] hover:text-[#FF6B35]')
                    }
                  >
                    {mg.name}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="text-xs text-[#A0AEC0]">暂无可选肌群</div>
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

        {error && <div className="rounded-lg bg-[#FFF5F5] px-3 py-2 text-xs text-[#C53030]">{error}</div>}
      </form>
    </Modal>
  )
}
