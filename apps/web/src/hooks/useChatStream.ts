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
  /**
   * Optimistic copy of the user's just-sent text. Cleared when the stream
   * finishes (or is aborted/errored) so it doesn't linger past the moment
   * the real user message appears in the conversation query. The conversation
   * query is invalidated on `done`, and the user message renders from the
   * server response on the next refetch.
   */
  pendingUserContent: string | null
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
  const [pendingUserContent, setPendingUserContent] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftReasoning, setDraftReasoning] = useState('')
  const [draftCitations, setDraftCitations] = useState<IAiCitation[]>([])
  const [draftUsage, setDraftUsage] = useState<IAiUsage | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setPendingUserContent(null)
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
      // Re-entrancy guard: if a previous stream is still running, abort it
      // before starting a new one so the orphaned reader can't keep writing
      // into our state.
      abortRef.current?.abort()

      const ac = new AbortController()
      abortRef.current = ac

      setStatus('streaming')
      setPendingUserContent(content)
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
                setPendingUserContent(null)
                setStatus('errored')
                return
              case 'done':
                // The real user message will be in the next refetch; clear
                // the optimistic copy so it doesn't double-render.
                setPendingUserContent(null)
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
      } catch (e: unknown) {
        if (isAbortError(e)) return
        setErrorMessage(errorMessageOf(e) ?? 'stream error')
        setPendingUserContent(null)
        setStatus('errored')
      } finally {
        // Only clear if we are still the active stream. A later start() may
        // have already replaced abortRef; its own finally will clear that.
        if (abortRef.current === ac) abortRef.current = null
      }
    },
    [qc],
  )

  return {
    status,
    pendingUserContent,
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

function isAbortError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'name' in e &&
    (e as { name?: unknown }).name === 'AbortError'
  )
}

function errorMessageOf(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return undefined
}
