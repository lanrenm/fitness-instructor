import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { aiService, type IConversation } from '../../services/aiService'

interface IProps {
  conversation: IConversation
  onClose: () => void
}

/**
 * @description 浮动设置面板:改标题 / 温度。点击面板外或 Esc 关闭。
 */
export function AiSettingsPopover({ conversation, onClose }: IProps) {
  const qc = useQueryClient()
  const [title, setTitle] = useState(conversation.title ?? '')
  const [temperature, setTemperature] = useState(conversation.temperature)
  const [busy, setBusy] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const save = async () => {
    setBusy(true)
    try {
      await aiService.updateConversation(conversation.id, {
        title: title || undefined,
        temperature,
      })
      await qc.invalidateQueries({ queryKey: ['ai-conversation', conversation.id] })
      await qc.invalidateQueries({ queryKey: ['ai-conversations'] })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="对话设置"
      className="absolute right-6 top-16 z-50 w-72 rounded-2xl border border-input bg-white p-4 shadow-lg"
    >
      <h3 className="mb-3 text-sm font-semibold text-[#2D3748]">对话设置</h3>
      <label className="mb-2 block text-xs text-muted-foreground">标题</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-3 w-full rounded-md border border-input px-2 py-1 text-sm outline-none focus:border-[#FF6B35]"
      />
      <label className="mb-2 block text-xs text-muted-foreground">
        温度 ({temperature.toFixed(2)})
      </label>
      <input
        type="range"
        min="0"
        max="2"
        step="0.05"
        value={temperature}
        onChange={(e) => setTemperature(Number(e.target.value))}
        className="mb-3 w-full accent-[#FF6B35]"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1 text-xs text-[#4A5568] hover:bg-accent"
        >
          取消
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-[#E55A2B] disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </div>
  )
}
