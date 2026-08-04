import { useState } from 'react'

interface IProps {
  disabled: boolean
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
  errorMessage: string | null
}

export function ChatInput({
  disabled,
  streaming,
  onSend,
  onStop,
  errorMessage,
}: IProps) {
  const [text, setText] = useState('')

  const submit = () => {
    const t = text.trim()
    if (!t || disabled) return
    onSend(t)
    setText('')
  }

  return (
    <div className="border-t border-input bg-white px-5 py-3">
      {errorMessage && (
        <div className="mb-2 rounded-md bg-[#FED7D7] px-3 py-2 text-xs text-[#C53030]">
          {errorMessage}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={disabled ? '生成中…' : '输入你的问题 (Cmd/Ctrl + Enter 发送)'}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#FF6B35] disabled:cursor-not-allowed disabled:opacity-50"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"
          >
            停止
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled || text.trim().length === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[#E55A2B] disabled:opacity-50"
          >
            发送
          </button>
        )}
      </div>
    </div>
  )
}
