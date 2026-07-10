import { useQuery } from '@tanstack/react-query'
import { overviewService } from '../services/overviewService'

export function useOverviewStats() {
  return useQuery({
    queryKey: ['overview', 'stats'],
    queryFn: () => overviewService.fetchStats(),
    staleTime: 60_000,
  })
}
