import { useState } from 'react'
import { MarkdownStream } from './MarkdownStream'

interface IProps {
  reasoning: string
}

export function ReasoningSection({ reasoning }: IProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[#FF6B35]"
      >
        <span
          className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          ▶
        </span>
        思考链{reasoning ? `(${reasoning.length} 字)` : ''}
      </button>
      {open && <MarkdownStream text={reasoning} muted label="Chain of Thought" />}
    </div>
  )
}
