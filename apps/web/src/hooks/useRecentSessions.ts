import { useQuery } from '@tanstack/react-query'
import { overviewService } from '../services/overviewService'

export function useRecentSessions(limit = 3) {
  return useQuery({
    queryKey: ['overview', 'recent-sessions', limit],
    queryFn: () => overviewService.fetchRecentSessions(limit),
    staleTime: 60_000,
  })
}
