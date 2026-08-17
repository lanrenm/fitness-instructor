import { useQuery } from '@tanstack/react-query';
import { exercisesService } from '../services/exercisesService';

export function useExercises() {
  const query = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exercisesService.list(),
    staleTime: 30_000,
  });
  return { ...query, items: query.data ?? [] };
}
