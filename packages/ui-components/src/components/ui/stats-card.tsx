import * as React from "react"
import { cn } from "@/lib/utils"

export interface StatsCardProps {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>
  value: React.ReactNode
  unit?: string
  label: string
  delta?: number
  iconColor?: { bg: string; fg: string }
  className?: string
}

export function StatsCard({ icon: Icon, value, unit, label, delta, iconColor, className }: StatsCardProps) {
  const color = iconColor ?? { bg: '#FFE4D9', fg: '#FF6B35' }
  const showDelta = delta != null && delta !== 0
  const deltaCls = delta == null ? '' : delta > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
  const sign = delta == null ? '' : delta > 0 ? '+' : ''

  return (
    <div className={cn('relative rounded-2xl bg-white px-6 py-6 shadow-[0_4px_16px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.03)]', className)}>
      {showDelta && (
        <span className={cn('absolute right-6 top-6 rounded-full px-2 py-0.5 text-xs font-semibold leading-tight', deltaCls)}>
          {sign}{delta}
        </span>
      )}
      <div className="grid h-12 w-12 place-items-center rounded-full" style={{ background: color.bg, color: color.fg }}>
        <Icon size={22} strokeWidth={2.2} aria-hidden />
      </div>
      <div className="mt-4">
        <div className="flex items-baseline gap-1 text-[#2D3748]">
          <span className="text-2xl font-bold leading-tight">{value}</span>
          {unit && <span className="text-base font-normal">{unit}</span>}
        </div>
        <div className="mt-1 text-xs text-[#718096]">{label}</div>
      </div>
    </div>
  )
}
