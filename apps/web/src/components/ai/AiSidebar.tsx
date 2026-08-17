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
 * `overflow-visible` 让 SearchBox 的下拉不被裁切。
 */
export function AiSidebar({ activeId, onSelect, onPickSearchHit }: IProps) {
  return (
    <aside className="flex h-full w-[280px] flex-col overflow-visible border-r border-input bg-accent">
      <div className="border-b border-input p-3">
        <SearchBox onPickHit={onPickSearchHit} />
      </div>
      <ConversationList activeId={activeId} onSelect={onSelect} />
    </aside>
  )
}
