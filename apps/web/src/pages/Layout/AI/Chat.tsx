import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AiSidebar, ChatPane } from '../../../components/ai'
import { useConversations } from '../../../hooks/useConversations'
import { aiService, type IConversation, type ISearchHit } from '../../../services/aiService'

export default function AIChat() {
  const { items } = useConversations()
  const [active, setActive] = useState<IConversation | null>(null)
  const [params] = useSearchParams()
  const navigate = useNavigate()

  // `?c=<convId>` (e.g. from search hit) deep-links into a specific conversation.
  useEffect(() => {
    const c = params.get('c')
    if (!c) return
    aiService.getConversation(c).then(setActive).catch(() => undefined)
  }, [params])

  const onSelect = (c: IConversation) => setActive(c)
  const onPickHit = (h: ISearchHit) => navigate(`/ai/chat?c=${h.conversationId}`)

  const current = active ?? items[0] ?? null

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-visible rounded-2xl border border-input bg-background shadow-sm">
      <AiSidebar
        activeId={current?.id ?? null}
        onSelect={onSelect}
        onPickSearchHit={onPickHit}
      />
      {current ? (
        <ChatPane conversation={current} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          从左侧选择或新建一个对话开始
        </div>
      )}
    </div>
  )
}
