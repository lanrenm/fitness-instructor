/**
 * @description 概览页数据 — stats / intensity / recent-sessions 三个 GET
 */

import { tryAuthedFetch } from './http';

export interface IOverviewStats {
  thisWeek: { count: number; durationMinutes: number; caloriesBurned: number }
  total: { count: number }
  lastWeek: { count: number; durationMinutes: number; caloriesBurned: number }
}

export interface IIntensityDay {
  weekday: number
  date: string
  intensity: number
}

export interface IIntensityResponse {
  days: IIntensityDay[]
}

export interface IRecentSession {
  id: string
  userId: string
  name: string
  startedAt: string
  durationMinutes: number
  exerciseCount: number
  intensity: number
  caloriesBurned: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export const overviewService = {
  async fetchStats(): Promise<IOverviewStats> {
    const res = await tryAuthedFetch('/api/overview/stats')
    if (!res.ok) throw new Error('获取统计数据失败')
    return res.json()
  },

  async fetchIntensity(): Promise<IIntensityResponse> {
    const res = await tryAuthedFetch('/api/overview/intensity')
    if (!res.ok) throw new Error('获取训练强度失败')
    return res.json()
  },

  async fetchRecentSessions(limit = 3): Promise<IRecentSession[]> {
    const res = await tryAuthedFetch(`/api/overview/recent-sessions?limit=${limit}`)
    if (!res.ok) throw new Error('获取最近训练记录失败')
    return res.json()
  },
}