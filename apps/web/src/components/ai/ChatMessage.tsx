import type { IAiMessage } from '../../services/aiService'
import { MarkdownStream } from './MarkdownStream'
import { ReasoningSection } from './ReasoningSection'
import { CitationList } from './CitationList'

interface IProps {
  message: IAiMessage
}

export function ChatMessage({ message }: IProps) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex max-w-[80%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
      >
        {!isUser && message.reasoning && <ReasoningSection reasoning={message.reasoning} />}
        <MarkdownStream text={message.content} muted={isUser} />
        {!isUser && message.ragContext && message.ragContext.length > 0 && (
          <CitationList hits={message.ragContext} />
        )}
      </div>
    </div>
  )
}
