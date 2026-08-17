import * as React from "react"
import { cn } from "@/lib/utils"
import { formatRelativeDate } from "@/lib/formatDate"

export interface SessionRecordItemProps {
  name: string
  startedAt: string | Date
  durationMinutes: number
  exerciseCount: number
  className?: string
}

export function SessionRecordItem({
  name,
  startedAt,
  durationMinutes,
  exerciseCount,
  className,
}: SessionRecordItemProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-[#2D3748]">{name}</div>
        <div className="mt-1 text-xs text-[#718096]">{formatRelativeDate(startedAt)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-[#2D3748]">{durationMinutes} 分钟</div>
        <div className="mt-0.5 text-xs text-[#718096]">{exerciseCount} 个动作</div>
      </div>
    </div>
  )
}