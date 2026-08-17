import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { muscleGroupsService, type IMuscleGroup } from '../services/muscleGroupsService'

export interface IMuscleGroupNode extends IMuscleGroup {
  children: IMuscleGroupNode[]
}

function buildTree(items: IMuscleGroup[]): IMuscleGroupNode[] {
  const map = new Map<string, IMuscleGroupNode>(items.map((g) => [g.id, { ...g, children: [] }]))
  const roots: IMuscleGroupNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function useMuscleGroups() {
  const query = useQuery({
    queryKey: ['muscleGroups'],
    queryFn: () => muscleGroupsService.list(),
    staleTime: 30_000,
  })
  const items = query.data ?? []
  const tree = useMemo(() => (items.length ? buildTree(items) : []), [items])
  return { ...query, items, tree }
}
