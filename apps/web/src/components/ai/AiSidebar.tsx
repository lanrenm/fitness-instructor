import { SearchBox } from './SearchBox'
import { ConversationList } from './ConversationList'
import type { IConversation, ISearchHit } from '../../services/aiService'

interface IProps {
  activeId: string | null
  onSelect: (c: IConversation) => void
  onPickSearchHit: (hit: ISearchHit) => void
}

/**
 * @description AI 侧边栏:顶部搜索 + 下方会话列表。
 */
export function AiSidebar({ activeId, onSelect, onPickSearchHit }: IProps) {
  return (
    <aside className="flex h-full w-[280px] flex-col border-r border-[#E2E8F0] bg-[#F7FAFC]">
      <div className="border-b border-[#E2E8F0] p-3">
        <SearchBox onPickHit={onPickSearchHit} />
      </div>
      <ConversationList activeId={activeId} onSelect={onSelect} />
    </aside>
  )
}
