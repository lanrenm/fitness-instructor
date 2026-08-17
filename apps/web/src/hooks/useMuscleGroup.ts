import { useQuery } from '@tanstack/react-query'
import { muscleGroupsService } from '../services/muscleGroupsService'

export function useMuscleGroup(id: string | null) {
  return useQuery({
    queryKey: ['muscleGroup', id],
    queryFn: () => muscleGroupsService.getOne(id as string),
    enabled: !!id,
    staleTime: 30_000,
  })
}
