import { useQuery } from '@tanstack/react-query'
import { aiService, type ISearchHit } from '../services/aiService'

/**
 * @description 跨会话全文+语义检索。`q` 长度 < 2 时不触发,避免无意义请求。
 */
export function useSearchConversations(q: string) {
  return useQuery({
    queryKey: ['ai-search', q],
    queryFn: () => aiService.searchConversations(q, 30),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  })
}

export type { ISearchHit }
