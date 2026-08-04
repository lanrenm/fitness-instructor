import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  aiService,
  type IAiCitation,
  type IAiUsage,
  type TAiStreamEvent,
} from '../services/aiService'

export type TStreamStatus = 'idle' | 'streaming' | 'done' | 'errored'

export interface IUseChatStreamResult {
  status: TStreamStatus
  draftContent: string
  draftReasoning: string
  draftCitations: IAiCitation[]
  draftUsage: IAiUsage | null
  errorMessage: string | null
  start: (conversationId: string, content: string) => Promise<void>
  stop: () => void
  reset: () => void
}

/**
 * @description 核心流式 hook:打开 SSE,把 `content/reasoning/citations/usage/done/error`
 * 增量累积到本地 state,流结束后 invalidate 列表与详情。`stop()` 中断流。
 */
export function useChatStream(): IUseChatStreamResult {
  const qc = useQueryClient()
  const [status, setStatus] = useState<TStreamStatus>('idle')
  const [draftContent, setDraftContent] = useState('')
  const [draftReasoning, setDraftReasoning] = useState('')
  const [draftCitations, setDraftCitations] = useState<IAiCitation[]>([])
  const [draftUsage, setDraftUsage] = useState<IAiUsage | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setDraftContent('')
    setDraftReasoning('')
    setDraftCitations([])
    setDraftUsage(null)
    setErrorMessage(null)
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus((s) => (s === 'streaming' ? 'idle' : s))
  }, [])

  const start = useCallback(
    async (conversationId: string, content: string) => {
      const ac = new AbortController()
      abortRef.current = ac

      setStatus('streaming')
      setDraftContent('')
      setDraftReasoning('')
      setDraftCitations([])
      setDraftUsage(null)
      setErrorMessage(null)

      try {
        const resp = await aiService.openMessageStream(conversationId, content, {
          signal: ac.signal,
        })
        const reader = resp.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // SSE 解析:event: xxx\ndata: {json}\n\n
          let idx
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            const lines = block.split('\n')
            let dataLine = ''
            for (const line of lines) {
              if (line.startsWith('data:')) dataLine += line.slice(5).trim()
            }
            if (!dataLine) continue
            let parsed: TAiStreamEvent
            try {
              parsed = JSON.parse(dataLine)
            } catch {
              continue
            }
            switch (parsed.type) {
              case 'content':
                setDraftContent((s) => s + (parsed.delta ?? ''))
                break
              case 'reasoning':
                setDraftReasoning((s) => s + (parsed.delta ?? ''))
                break
              case 'citations':
                setDraftCitations(parsed.hits)
                break
              case 'usage':
                setDraftUsage({
                  promptTokens: parsed.promptTokens,
                  completionTokens: parsed.completionTokens,
                  ragHits: parsed.ragHits,
                  compressed: parsed.compressed,
                })
                break
              case 'error':
                setErrorMessage(parsed.error.message)
                setStatus('errored')
                return
              case 'done':
                setStatus('done')
                break
              default:
                break
            }
          }
        }
        setStatus('done')
        await qc.invalidateQueries({ queryKey: ['ai-conversation', conversationId] })
        await qc.invalidateQueries({ queryKey: ['ai-conversations'] })
      } catch (e: any) {
        if (e?.name === 'AbortError') return
        setErrorMessage(e?.message ?? 'stream error')
        setStatus('errored')
      } finally {
        abortRef.current = null
      }
    },
    [qc],
  )

  return {
    status,
    draftContent,
    draftReasoning,
    draftCitations,
    draftUsage,
    errorMessage,
    start,
    stop,
    reset,
  }
}
