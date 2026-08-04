import { useEffect, useRef } from 'react'
import type { IAiMessage } from '../../services/aiService'
import { ChatMessage } from './ChatMessage'
import { MarkdownStream } from './MarkdownStream'
import { StreamingDots } from './StreamingDots'

interface IProps {
  messages: IAiMessage[]
  streaming: boolean
  draftContent: string
  draftReasoning: string
}

export function MessageList({
  messages,
  streaming,
  draftContent,
  draftReasoning,
}: IProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, draftContent, draftReasoning, streaming])

  return (
    <div ref={ref} className="flex-1 overflow-y-auto bg-background px-5 py-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {streaming && (
          <div className="flex flex-col gap-2">
            {draftReasoning && (
              <MarkdownStream text={draftReasoning} muted label="思考中" />
            )}
            <MarkdownStream text={draftContent} />
            {!draftContent && <StreamingDots />}
          </div>
        )}
      </div>
    </div>
  )
}
