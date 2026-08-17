import { useQuery } from '@tanstack/react-query'
import { aiService, type IConversation } from '../services/aiService'

/**
 * @description 获取当前用户的会话列表(默认 50 条,按 updatedAt 倒序)。
 */
export function useConversations() {
  const q = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => aiService.listConversations(50),
    staleTime: 30_000,
  })
  return { ...q, items: (q.data ?? []) as IConversation[] }
}
