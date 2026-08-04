import { useEffect, useState } from 'react'
import { useSearchConversations } from '../../hooks/useSearchConversations'
import type { ISearchHit } from '../../services/aiService'

interface IProps {
  onPickHit: (hit: ISearchHit) => void
}

/**
 * @description 跨会话全文+语义检索。250ms 防抖,trim 后长度 < 2 不触发请求。
 */
export function SearchBox({ onPickHit }: IProps) {
  const [q, setQ] = useState('')
  const debounced = useDebounced(q, 250)
  const { data: hits = [], isFetching } = useSearchConversations(debounced)
  const show = debounced.trim().length >= 2

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索历史对话…"
        className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6B35]"
      />
      {show && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
          {isFetching && hits.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#718096]">搜索中…</div>
          ) : hits.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#718096]">无匹配</div>
          ) : (
            hits.map((h) => (
              <button
                key={`${h.messageId}-${h.matchType}`}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[#F7FAFC]"
                onClick={() => {
                  onPickHit(h)
                  setQ('')
                }}
              >
                <div className="line-clamp-2 text-[#2D3748]">{h.snippet}</div>
                <div className="text-[10px] text-[#A0AEC0]">
                  {h.matchType} · score {h.score.toFixed(2)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}
