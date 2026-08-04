import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface IProps {
  text: string
  muted?: boolean
  label?: string
}

export function MarkdownStream({ text, muted, label }: IProps) {
  return (
    <div
      className={`rounded-2xl border border-input px-4 py-3 ${
        muted ? 'bg-accent text-[#4A5568]' : 'bg-white text-[#2D3748] shadow-sm'
      }`}
    >
      {label && (
        <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>
      )}
      <div className="prose prose-sm max-w-none text-sm leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </div>
  )
}
