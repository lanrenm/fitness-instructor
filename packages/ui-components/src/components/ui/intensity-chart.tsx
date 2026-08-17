import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"

export interface IntensityDay {
  weekday: number // 1=Mon ... 7=Sun
  date: string
  intensity: number // 0-100
}

const WEEKDAY_LABEL: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
}

export interface IntensityChartProps {
  data: IntensityDay[]
  height?: number
  className?: string
}

export function IntensityChart({ data, height = 240, className }: IntensityChartProps) {
  const enriched = data.map((d) => ({ ...d, label: WEEKDAY_LABEL[d.weekday] ?? '' }))
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={enriched} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#718096', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#A0AEC0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255, 107, 53, 0.06)' }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #EDF2F7',
              boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
              fontSize: 12,
            }}
            formatter={(v) => [`${v}%`, '强度']}
            labelFormatter={(l) => l}
          />
          <Bar dataKey="intensity" fill="#FF6B35" radius={[8, 8, 0, 0]} maxBarSize={56}>
            <LabelList
              dataKey="intensity"
              position="top"
              formatter={(v) => (typeof v === 'number' && v > 0 ? `${v}%` : '')}
              style={{ fill: '#2D3748', fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}