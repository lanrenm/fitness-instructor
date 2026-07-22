import { useMutation, useQueryClient } from '@tanstack/react-query'
import { muscleGroupsService, type IMuscleGroupInput } from '../services/muscleGroupsService'

export function useMuscleGroupMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['muscleGroups'] })
    qc.invalidateQueries({ queryKey: ['muscleGroup'] })
  }

  const create = useMutation({
    mutationFn: (input: IMuscleGroupInput) => muscleGroupsService.create(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<IMuscleGroupInput> }) =>
      muscleGroupsService.update(id, input),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => muscleGroupsService.remove(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
