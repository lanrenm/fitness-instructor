import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StatsCardProps {
  icon: LucideIcon
  value: React.ReactNode
  label: string
  /** 增量：正数绿、负数红、0 灰。不传则不显示徽标 */
  delta?: number
  /** 自定义图标底色（默认橙 #FFE4D9 文字 #FF6B35） */
  iconColor?: { bg: string; fg: string }
  className?: string
}

export function StatsCard({ icon: Icon, value, label, delta, iconColor, className }: StatsCardProps) {
  const color = iconColor ?? { bg: '#FFE4D9', fg: '#FF6B35' }
  const showDelta = delta != null && delta !== 0
  const deltaCls =
    delta == null
      ? ''
      : delta > 0
        ? 'bg-green-50 text-green-600'
        : 'bg-red-50 text-red-500'
  const sign = delta == null ? '' : delta > 0 ? '+' : ''
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.03)]',
        className,
      )}
    >
      {showDelta && (
        <span
          className={cn(
            'absolute right-4 top-4 rounded-full px-2 py-0.5 text-xs font-semibold',
            deltaCls,
          )}
        >
          {sign}
          {delta}
        </span>
      )}
      <div
        className="grid h-12 w-12 place-items-center rounded-full"
        style={{ background: color.bg, color: color.fg }}
      >
        <Icon size={22} strokeWidth={2.2} aria-hidden />
      </div>
      <div>
        <div className="text-2xl font-bold text-[#2D3748] leading-tight">{value}</div>
        <div className="mt-1 text-xs text-[#718096]">{label}</div>
      </div>
    </div>
  )
}
