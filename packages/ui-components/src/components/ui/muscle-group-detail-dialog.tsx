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