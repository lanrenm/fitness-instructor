/**
 * @description 动作管理 - 5 个 CRUD fetch
 */

import { tryAuthedFetch } from './http';

export interface IExerciseTargetMuscle {
  id: string;
  name: string;
}

export interface IExercise {
  id: string;
  name: string;
  description: string | null;
  category: number;
  difficulty: number;
  equipment: string[];
  targetMuscles: IExerciseTargetMuscle[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IExerciseInput {
  name: string;
  description?: string;
  category: number;
  difficulty: number;
  equipment?: string[];
  muscleGroupIds: string[];
  isActive?: boolean;
}

export const exercisesService = {
  async list(): Promise<IExercise[]> {
    const res = await tryAuthedFetch('/api/exercises');
    if (!res.ok) throw new Error(await safeMsg(res, '获取动作列表失败'));
    return res.json();
  },

  async getOne(id: string): Promise<IExercise> {
    const res = await tryAuthedFetch(`/api/exercises/${id}`);
    if (!res.ok) throw new Error(await safeMsg(res, '获取动作详情失败'));
    return res.json();
  },

  async create(input: IExerciseInput): Promise<IExercise> {
    const res = await tryAuthedFetch('/api/exercises', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await safeMsg(res, '创建动作失败'));
    return res.json();
  },

  async update(id: string, input: Partial<IExerciseInput>): Promise<IExercise> {
    const res = await tryAuthedFetch(`/api/exercises/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await safeMsg(res, '更新动作失败'));
    return res.json();
  },

  async remove(id: string): Promise<void> {
    const res = await tryAuthedFetch(`/api/exercises/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await safeMsg(res, '删除动作失败'));
  },
};

async function safeMsg(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return (data as { message?: string }).message ?? fallback;
  } catch {
    return fallback;
  }
}
