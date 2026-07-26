import { useQuery } from '@tanstack/react-query';
import { exercisesService } from '../services/exercisesService';

export function useExercise(id: string | null) {
  return useQuery({
    queryKey: ['exercise', id],
    queryFn: () => exercisesService.getOne(id as string),
    enabled: !!id,
    staleTime: 30_000,
  });
}
