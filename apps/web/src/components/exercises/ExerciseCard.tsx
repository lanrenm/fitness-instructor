import { cn } from '@fitness/ui-components'
import type { IExercise } from '../../services/exercisesService'
import { CATEGORY_MAP, DIFFICULTY_MAP } from './constants'

export interface ExerciseCardProps {
  exercise: IExercise
  onSelect?: (exercise: IExercise) => void
  className?: string
}

export function ExerciseCard({ exercise, onSelect, className }: ExerciseCardProps) {
  const difficulty = DIFFICULTY_MAP[exercise.difficulty as 1 | 2 | 3]
  const categoryLabel = CATEGORY_MAP[exercise.category as 1 | 2 | 3 | 4 | 5 | 6]
  const muscles = exercise.targetMuscles.map((m) => m.name).join('、')
  const equipment = exercise.equipment.length > 0 ? exercise.equipment.join('、') : '无'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(exercise)}
      className={cn(
        'group flex w-full flex-col gap-2 rounded-2xl bg-[#F7FAFC] p-5 text-left transition hover:bg-white hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)]',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-base font-bold text-[#2D3748]">{exercise.name}</span>
        {difficulty && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              difficulty.badgeClass,
            )}
          >
            {difficulty.label}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-medium text-[#4A5568]">
          分类：<span className="font-normal text-[#718096]">{categoryLabel ?? `分类${exercise.category}`}</span>
        </span>
        <span className="font-medium text-[#4A5568]">
          器械：<span className="font-normal text-[#718096]">{equipment}</span>
        </span>
        <span className="font-medium text-[#4A5568]">
          目标肌群：<span className="font-normal text-[#718096]">{muscles || '无'}</span>
        </span>
      </div>
    </button>
  )
}