import type { IConversation } from '../../services/aiService'

interface IProps {
  conversation: IConversation
  streaming: boolean
  onOpenSettings: () => void
}

export function ChatHeader({ conversation, streaming, onOpenSettings }: IProps) {
  return (
    <header className="flex items-center justify-between border-b border-input bg-white px-5 py-3">
      <div className="flex flex-col">
        <h2 className="text-base font-semibold text-[#2D3748]">
          {conversation.title || '新对话'}
        </h2>
        <div className="text-xs text-muted-foreground">
          model: {conversation.model} · temp {conversation.temperature}
          {streaming ? ' · 流式中…' : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenSettings}
        className="rounded-md border border-input px-3 py-1 text-sm text-[#4A5568] hover:bg-accent"
      >
        设置
      </button>
    </header>
  )
}
