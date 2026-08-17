/**
 * @description 肌群管理 - 5 个 CRUD fetch
 */

import { tryAuthedFetch } from './http';

export interface IMuscleGroup {
  id: string
  name: string
  description: string | null
  parentId: string | null
  isActive: boolean
  exerciseCount: number
  createdAt: string
  updatedAt: string
}

export interface IMuscleGroupInput {
  name: string
  description?: string
  parentId?: string | null
  isActive?: boolean
}

export const muscleGroupsService = {
  async list(): Promise<IMuscleGroup[]> {
    const res = await tryAuthedFetch('/api/muscle-groups')
    if (!res.ok) throw new Error(await safeMsg(res, '获取肌群列表失败'))
    return res.json()
  },

  async getOne(id: string): Promise<IMuscleGroup> {
    const res = await tryAuthedFetch(`/api/muscle-groups/${id}`)
    if (!res.ok) throw new Error(await safeMsg(res, '获取肌群详情失败'))
    return res.json()
  },

  async create(input: IMuscleGroupInput): Promise<IMuscleGroup> {
    const res = await tryAuthedFetch('/api/muscle-groups', { method: 'POST', body: JSON.stringify(input) })
    if (!res.ok) throw new Error(await safeMsg(res, '创建肌群失败'))
    return res.json()
  },

  async update(id: string, input: Partial<IMuscleGroupInput>): Promise<IMuscleGroup> {
    const res = await tryAuthedFetch(`/api/muscle-groups/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
    if (!res.ok) throw new Error(await safeMsg(res, '更新肌群失败'))
    return res.json()
  },

  async remove(id: string): Promise<void> {
    const res = await tryAuthedFetch(`/api/muscle-groups/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await safeMsg(res, '删除肌群失败'))
  },
}

async function safeMsg(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return (data as { message?: string }).message ?? fallback
  } catch {
    return fallback
  }
}
