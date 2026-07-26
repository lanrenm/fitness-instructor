import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  exercisesService,
  type IExerciseInput,
} from '../services/exercisesService';

export function useExerciseMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['exercises'] });
    qc.invalidateQueries({ queryKey: ['exercise'] });
  };

  const create = useMutation({
    mutationFn: (input: IExerciseInput) => exercisesService.create(input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<IExerciseInput>;
    }) => exercisesService.update(id, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => exercisesService.remove(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
