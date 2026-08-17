import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeCls: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, footer, size = 'md', className }: ModalProps) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={cn('w-full rounded-2xl bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]', sizeCls[size], className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[#EDF2F7] px-6 py-4">
            <h3 className="text-base font-semibold text-[#2D3748]">{title}</h3>
            <button onClick={onClose} aria-label="关闭" className="grid h-8 w-8 place-items-center rounded-full text-[#718096] hover:bg-[#F7FAFC]">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 border-t border-[#EDF2F7] px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}