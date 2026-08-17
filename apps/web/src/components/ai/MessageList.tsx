import { useEffect, useMemo, useRef } from 'react'
import type { IAiMessage } from '../../services/aiService'
import { ChatMessage } from './ChatMessage'

interface IProps {
  messages: IAiMessage[]
  streaming: boolean
  draftContent: string
  draftReasoning: string
  pendingUserContent: string | null
}

// Synthetic ids for the optimistic UI rows. Negative ids keep them disjoint
// from real DB ids (which are uuid strings) so React's key set stays stable
// even if a real message happens to share a label.
const PENDING_USER_ID = '__pending_user__'
const STREAMING_ASSISTANT_ID = '__streaming_assistant__'

export function MessageList({
  messages,
  streaming,
  draftContent,
  draftReasoning,
  pendingUserContent,
}: IProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Append optimistic rows at the tail: the user's just-sent bubble, then
  // the streaming assistant bubble. Both render through ChatMessage so they
  // get the same alignment / typography as real persisted messages.
  const displayMessages = useMemo<IAiMessage[]>(() => {
    const out: IAiMessage[] = [...messages]
    if (pendingUserContent) {
      out.push({
        id: PENDING_USER_ID,
        conversationId: '',
        role: 'user',
        content: pendingUserContent,
        reasoning: null,
        ragContext: null,
        providerId: null,
        promptTokens: 0,
        completionTokens: 0,
        compressed: false,
        createdAt: '',
      })
    }
    if (streaming) {
      out.push({
        id: STREAMING_ASSISTANT_ID,
        conversationId: '',
        role: 'assistant',
        content: draftContent,
        reasoning: draftReasoning || null,
        ragContext: null,
        providerId: null,
        promptTokens: 0,
        completionTokens: 0,
        compressed: false,
        createdAt: '',
      })
    }
    return out
  }, [messages, streaming, draftContent, draftReasoning, pendingUserContent])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [displayMessages])

  return (
    <div ref={ref} className="flex-1 overflow-y-auto bg-background">
      {/* Full-bleed column — no mx-auto / max-w. Each ChatMessage already
          anchors user/assistant bubbles to right/left, so the bubbles hug
          the panel edges instead of sitting in a centered band. The
          `sm:px-6` etc. give the bubbles some breathing room on wide
          screens without re-centering them. */}
      <div className="flex flex-col gap-4 px-3 py-4 sm:px-6">
        {displayMessages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            streaming={m.id === STREAMING_ASSISTANT_ID && streaming}
          />
        ))}
      </div>
    </div>
  )
}
