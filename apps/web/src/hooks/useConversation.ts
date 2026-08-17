import { useQuery } from '@tanstack/react-query'
import { aiService } from '../services/aiService'

/**
 * @description 获取单个会话及其全部消息。`id === null` 时不触发请求。
 */
export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['ai-conversation', id],
    queryFn: () => aiService.getConversation(id as string),
    enabled: !!id,
    staleTime: 10_000,
  })
}
