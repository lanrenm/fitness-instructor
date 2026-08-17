import * as React from "react"
import { cn } from "@/lib/utils"
import { StatsCard, type StatsCardProps } from "./stats-card"

interface StatsCardGroupProps {
  items: StatsCardProps[]
  /** 默认 4 列。传 2 走 2 列布局 */
  columns?: 2 | 4
  className?: string
}

export function StatsCardGroup({ items, columns = 4, className }: StatsCardGroupProps) {
  const gridCls =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  return (
    <div className={cn('grid gap-4', gridCls, className)}>
      {items.map((item, i) => (
        <StatsCard key={i} {...item} />
      ))}
    </div>
  )
}
