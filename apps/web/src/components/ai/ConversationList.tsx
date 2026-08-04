import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConversations } from '../../hooks/useConversations'
import { aiService, type IConversation } from '../../services/aiService'

interface IProps {
  activeId: string | null
  onSelect: (c: IConversation) => void
}

/**
 * @description 会话列表。新建按钮:创建并立即进入新会话;列表项:点击切换。
 */
export function ConversationList({ activeId, onSelect }: IProps) {
  const qc = useQueryClient()
  const { items, isLoading } = useConversations()
  const [creating, setCreating] = useState(false)

  const onCreate = async () => {
    if (creating) return
    setCreating(true)
    try {
      const c = await aiService.createConversation()
      await qc.invalidateQueries({ queryKey: ['ai-conversations'] })
      onSelect(c)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <button
        type="button"
        onClick={onCreate}
        disabled={creating}
        className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-[#E55A2B] disabled:opacity-50"
      >
        {creating ? '创建中…' : '+ 新对话'}
      </button>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-xs text-muted-foreground">加载中…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-muted-foreground">尚无对话</div>
        ) : (
          items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              aria-current={c.id === activeId ? 'true' : undefined}
              className={`block w-full truncate rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent ${
                c.id === activeId
                  ? 'bg-[#FFE7EC] font-semibold text-[#FF6B35]'
                  : 'text-[#2D3748]'
              }`}
            >
              {c.title || '未命名对话'}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
