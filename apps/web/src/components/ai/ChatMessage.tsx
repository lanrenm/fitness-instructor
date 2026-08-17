import type { IAiMessage } from '../../services/aiService'
import { MarkdownStream } from './MarkdownStream'
import { ReasoningSection } from './ReasoningSection'
import { CitationList } from './CitationList'
import { StreamingDots } from './StreamingDots'

interface IProps {
  message: IAiMessage
  /**
   * Marks this message as the live-streaming assistant bubble. When set and
   * the bubble's text is still empty (between SSE open and the first
   * content delta), we render the bouncing dots inside the bubble instead
   * of an empty MarkdownStream — keeps the bubble's height stable and
   * visually anchors the "thinking" indicator to its owner.
   */
  streaming?: boolean
}

export function ChatMessage({ message, streaming = false }: IProps) {
  const isUser = message.role === 'user'
  const showDots = streaming && !isUser && !message.content
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex max-w-[85%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
      >
        {!isUser && message.reasoning && <ReasoningSection reasoning={message.reasoning} />}
        {showDots ? (
          <StreamingDots />
        ) : (
          <MarkdownStream text={message.content} muted={isUser} />
        )}
        {!isUser && message.ragContext && message.ragContext.length > 0 && (
          <CitationList hits={message.ragContext} />
        )}
      </div>
    </div>
  )
}
