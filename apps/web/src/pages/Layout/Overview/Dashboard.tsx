/**
 * @description 概览 - 仪表盘：4 统计卡 + 周训练强度 + 最近 3 条记录。
 * 数据来自 3 个 GET（stats / intensity / recent-sessions），
 * 公共组件抽到 @fitness/ui-components。
 */
import { Calendar, Flame, Target, TrendingUp } from 'lucide-react'
import {
  IntensityChart,
  SectionCard,
  SessionRecordItem,
  StatsCardGroup,
} from '@fitness/ui-components'
import { useOverviewIntensity } from '../../../hooks/useOverviewIntensity'
import { useOverviewStats } from '../../../hooks/useOverviewStats'
import { useRecentSessions } from '../../../hooks/useRecentSessions'

export default function OverviewDashboard() {
  const stats = useOverviewStats()
  const intensity = useOverviewIntensity()
  const recent = useRecentSessions(3)

  const s = stats.data
  const thisWeekDelta = (label: 'count' | 'durationMinutes' | 'caloriesBurned') => {
    if (!s) return undefined
    return s.thisWeek[label] - s.lastWeek[label]
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-[#2D3748]">训练概览</h1>
        <p className="mt-1 text-sm text-[#718096]">你的健身数据一览</p>
      </header>

      <StatsCardGroup
        items={[
          {
            icon: Calendar,
            value: s ? `${s.thisWeek.count} 次` : '—',
            label: '本周训练',
            delta: thisWeekDelta('count'),
          },
          {
            icon: TrendingUp,
            value: s ? `${s.thisWeek.durationMinutes} 分钟` : '—',
            label: '训练时长',
            delta: thisWeekDelta('durationMinutes'),
          },
          {
            icon: Flame,
            value: s ? `${s.thisWeek.caloriesBurned.toLocaleString()} kcal` : '—',
            label: '消耗热量',
            delta: thisWeekDelta('caloriesBurned'),
          },
          {
            icon: Target,
            value: s ? `${s.total.count} 个` : '—',
            label: '达成目标',
            delta: s ? s.thisWeek.count : undefined,
          },
        ]}
      />

      <SectionCard title="本周训练强度">
        {intensity.data ? (
          <IntensityChart data={intensity.data.days} />
        ) : (
          <div className="h-[240px] animate-pulse rounded-xl bg-[#F7FAFC]" />
        )}
      </SectionCard>

      <SectionCard title="最近训练记录">
        {recent.data ? (
          <div className="flex flex-col gap-3">
            {recent.data.length === 0 && (
              <div className="py-8 text-center text-sm text-[#718096]">还没有训练记录</div>
            )}
            {recent.data.map((r) => (
              <SessionRecordItem
                key={r.id}
                name={r.name}
                startedAt={r.startedAt}
                durationMinutes={r.durationMinutes}
                exerciseCount={r.exerciseCount}
              />
            ))}
          </div>
        ) : (
          <div className="h-32 animate-pulse rounded-xl bg-[#F7FAFC]" />
        )}
      </SectionCard>
    </div>
  )
}
