import { useState } from 'react'
import type { IAiCitation } from '../../services/aiService'

interface IProps {
  hits: IAiCitation[]
}

export function CitationList({ hits }: IProps) {
  const [open, setOpen] = useState(false)
  if (hits.length === 0) return null
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-muted-foreground hover:text-[#FF6B35]"
      >
        ▶ 引用来源 ({hits.length})
      </button>
      {open && (
        <ul className="mt-1 flex flex-col gap-1">
          {hits.map((h, i) => (
            <li
              key={`${h.type}-${h.id}-${i}`}
              className="rounded-md border border-input bg-accent px-2 py-1 text-xs text-[#4A5568]"
            >
              <span className="font-mono">[{i + 1}]</span>{' '}
              <span className="font-semibold">{h.type}</span> · score{' '}
              {h.score.toFixed(2)}
              <div className="line-clamp-2 text-muted-foreground">{h.snippet}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
