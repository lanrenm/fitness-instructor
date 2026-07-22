import * as React from 'react'
import { Modal } from '@fitness/ui-components'

export interface ParentOption {
  id: string
  name: string
}

export interface MuscleGroupFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: { name?: string; description?: string | null; parentId?: string | null; isActive?: boolean }
  parentOptions?: ParentOption[]
  defaultParentId?: string
  excludeParentIds?: string[]
  onClose: () => void
  onSubmit: (values: { name: string; description?: string; parentId?: string | null; isActive?: boolean }) => void | Promise<void>
}

export function MuscleGroupFormDialog({ open, mode, initial, parentOptions, defaultParentId, excludeParentIds, onClose, onSubmit }: MuscleGroupFormDialogProps) {
  const [name, setName] = React.useState(initial?.name ?? '')
  const [description, setDescription] = React.useState(initial?.description ?? '')
  const [parentId, setParentId] = React.useState<string | null>(initial?.parentId ?? defaultParentId ?? null)
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setDescription(initial?.description ?? '')
    setParentId(initial?.parentId ?? defaultParentId ?? null)
    setIsActive(initial?.isActive ?? true)
    setError(null)
  }, [open, initial, defaultParentId])

  const title = mode === 'create' ? '添加肌群' : '编辑肌群'

  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#4A5568] hover:bg-[#F7FAFC]">取消</button>
          <button
            disabled={submitting || !name.trim()}
            onClick={async () => {
              setSubmitting(true); setError(null)
              try {
                await onSubmit({ name: name.trim(), description: description || undefined, parentId, isActive })
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : '提交失败')
              } finally {
                setSubmitting(false)
              }
            }}
            className="rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white hover:bg-[#E55A2B] disabled:opacity-50"
          >
            {submitting ? '提交中…' : '保存'}
          </button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">名称 <span className="text-[#E53E3E]">*</span></span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：胸大肌"
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">描述</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="肌群说明（可选）"
            className="resize-none rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#4A5568]">父级肌群</span>
          <select
            value={parentId ?? ''}
            onChange={(e) => setParentId(e.target.value || null)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3748] outline-none focus:border-[#FF6B35]"
          >
            <option value="">无（一级）</option>
            {parentOptions
              ?.filter((o) => !(excludeParentIds ?? []).includes(o.id))
              .map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[#FF6B35]" />
          <span className="text-sm text-[#4A5568]">启用</span>
        </label>
        {error && <div className="rounded-lg bg-[#FFF5F5] px-3 py-2 text-xs text-[#C53030]">{error}</div>}
      </form>
    </Modal>
  )
}