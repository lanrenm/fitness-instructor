import { useQuery } from '@tanstack/react-query'
import { overviewService } from '../services/overviewService'

export function useOverviewIntensity() {
  return useQuery({
    queryKey: ['overview', 'intensity'],
    queryFn: () => overviewService.fetchIntensity(),
    staleTime: 60_000,
  })
}
