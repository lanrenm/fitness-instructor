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