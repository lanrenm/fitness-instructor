import { useEffect, useState } from 'react'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { AiSettingsPopover } from './AiSettingsPopover'
import { useConversation } from '../../hooks/useConversation'
import { useChatStream } from '../../hooks/useChatStream'
import type { IConversation } from '../../services/aiService'

interface IProps {
  conversation: IConversation
}

export function ChatPane({ conversation }: IProps) {
  const { data } = useConversation(conversation.id)
  const stream = useChatStream()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Reset stream state when switching conversations.
  useEffect(() => {
    stream.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id])

  const messages = data?.messages ?? []
  const isStreaming = stream.status === 'streaming'

  const handleSend = async (text: string) => {
    await stream.start(conversation.id, text)
  }

  return (
    <section className="flex h-full flex-1 flex-col bg-background">
      <ChatHeader
        conversation={conversation}
        streaming={isStreaming}
        onOpenSettings={() => setSettingsOpen((v) => !v)}
      />
      <MessageList
        messages={messages}
        streaming={isStreaming}
        draftContent={stream.draftContent}
        draftReasoning={stream.draftReasoning}
        pendingUserContent={stream.pendingUserContent}
      />
      <ChatInput
        disabled={isStreaming}
        streaming={isStreaming}
        onSend={handleSend}
        onStop={stream.stop}
        errorMessage={stream.errorMessage}
      />
      {settingsOpen && (
        <AiSettingsPopover
          conversation={conversation}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </section>
  )
}
