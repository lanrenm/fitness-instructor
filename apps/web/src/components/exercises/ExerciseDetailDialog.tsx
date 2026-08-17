import { Edit2, Trash2, ChevronRight } from 'lucide-react'
import { Modal } from '@fitness/ui-components'
import type { IExercise } from '../../services/exercisesService'
import { CATEGORY_MAP, DIFFICULTY_MAP } from './constants'

export interface ExerciseDetailDialogProps {
  exercise: IExercise
  onEdit: (exercise: IExercise) => void
  onDelete: (exercise: IExercise) => void
  onClose: () => void
}

export function ExerciseDetailDialog({ exercise, onEdit, onDelete, onClose }: ExerciseDetailDialogProps) {
  const difficulty = DIFFICULTY_MAP[exercise.difficulty as 1 | 2 | 3]
  const categoryLabel = CATEGORY_MAP[exercise.category as 1 | 2 | 3 | 4 | 5 | 6]
  const equipment = exercise.equipment.length > 0 ? exercise.equipment.join('、') : '无'

  return (
    <Modal open onClose={onClose} size="lg"
      footer={
        <>
          <button
            onClick={() => onDelete(exercise)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#FED7D7] bg-white px-4 py-2 text-sm font-medium text-[#C53030] hover:bg-[#FFF5F5]"
          >
            <Trash2 size={14} /> 删除
          </button>
          <button
            onClick={() => onEdit(exercise)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white hover:bg-[#E55A2B]"
          >
            <Edit2 size={14} /> 编辑
          </button>
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
            {difficulty && (
              <span
                className={
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                  difficulty.badgeClass
                }
              >
                {difficulty.label}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-[#718096]">
            分类：{categoryLabel ?? `分类${exercise.category}`}　|　器械：{equipment}
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
              <span
                key={m.id}
                className="inline-flex items-center rounded-md border border-[#EDF2F7] bg-[#F7FAFC] px-2.5 py-1 text-xs text-[#2D3748]"
              >
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
  )
}
