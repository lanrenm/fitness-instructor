/**
 * @description AI 对话 - 会话 CRUD、跨会话检索,以及 SSE 流的开启。
 */

import type { IAiCitation, IAiError, IAiUsage, TAiMessageRole } from '@fitness/shared-types/ai'
import { tryAuthedFetch } from './http'

export interface IConversation {
  id: string
  userId: string
  title: string | null
  summary: string | null
  model: string
  temperature: number
  createdAt: string
  updatedAt: string
}

export interface IAiMessage {
  id: string
  conversationId: string
  role: TAiMessageRole
  content: string
  reasoning: string | null
  ragContext: IAiCitation[] | null
  providerId: string | null
  promptTokens: number
  completionTokens: number
  compressed: boolean
  createdAt: string
}

export type TAiStreamEvent =
  | { type: 'meta'; conversationId: string; messageId?: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'content'; delta: string }
  | { type: 'citations'; hits: IAiCitation[] }
  | ({ type: 'usage' } & IAiUsage)
  | { type: 'done'; finishReason?: string }
  | { type: 'error'; error: IAiError }

export interface ISearchHit {
  conversationId: string
  messageId: string
  snippet: string
  score: number
  matchType: 'keyword' | 'semantic'
}

export interface IConversationInput {
  model?: string
  temperature?: number
}

export interface IConversationPatch {
  title?: string
  model?: string
  temperature?: number
}

const BASE = '/api/ai'

export const aiService = {
  async listConversations(limit = 20, cursor?: string): Promise<IConversation[]> {
    const qs = new URLSearchParams({ limit: String(limit) })
    if (cursor) qs.set('cursor', cursor)
    const res = await tryAuthedFetch(`${BASE}/conversations?${qs}`)
    if (!res.ok) throw new Error(await safeMsg(res, '获取会话列表失败'))
    return res.json()
  },

  async createConversation(input: IConversationInput = {}): Promise<IConversation> {
    const res = await tryAuthedFetch(`${BASE}/conversations`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(await safeMsg(res, '创建会话失败'))
    return res.json()
  },

  async getConversation(id: string): Promise<IConversation & { messages: IAiMessage[] }> {
    const res = await tryAuthedFetch(`${BASE}/conversations/${id}`)
    if (!res.ok) throw new Error(await safeMsg(res, '获取会话详情失败'))
    return res.json()
  },

  async updateConversation(id: string, patch: IConversationPatch): Promise<IConversation> {
    const res = await tryAuthedFetch(`${BASE}/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(await safeMsg(res, '更新会话失败'))
    return res.json()
  },

  async deleteConversation(id: string): Promise<{ deleted: boolean }> {
    const res = await tryAuthedFetch(`${BASE}/conversations/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await safeMsg(res, '删除会话失败'))
    return res.json()
  },

  async searchConversations(q: string, limit = 20): Promise<ISearchHit[]> {
    const qs = new URLSearchParams({ q, limit: String(limit) })
    const res = await tryAuthedFetch(`${BASE}/search?${qs}`)
    if (!res.ok) throw new Error(await safeMsg(res, '检索会话失败'))
    return res.json()
  },

  /**
   * @description 开启 SSE 流,返回原始 Response 供 useChatStream 读 body 解析。
   * 用 fetch 而非 EventSource 是为了支持 POST + Authorization header + abort;
   * 走 tryAuthedFetch 以复用 401 refresh + retry。
   * @param conversationId 会话 id
   * @param content 用户输入
   * @param options model 覆盖、regenerate 标记、中断信号
   * @returns 带可读 body 的 Response
   */
  async openMessageStream(
    conversationId: string,
    content: string,
    options: { model?: string; regenerate?: boolean; signal?: AbortSignal } = {},
  ): Promise<Response> {
    const res = await tryAuthedFetch(`${BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
      body: JSON.stringify({
        content,
        model: options.model,
        regenerate: options.regenerate,
      }),
      signal: options.signal,
    })
    if (!res.ok || !res.body) {
      throw new Error(await safeMsg(res, `建立对话流失败: ${res.status}`))
    }
    return res
  },
}

async function safeMsg(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return (data as { message?: string }).message ?? fallback
  } catch {
    return fallback
  }
}

export type { IAiCitation, IAiError, IAiUsage }
