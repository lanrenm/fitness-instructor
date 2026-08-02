/**
 * AI Chat 共享类型(前后端 + 共享模型注册表契约)。
 * 单一来源,任何字段调整需先改这里,再调消费方。
 */

export const AI_MESSAGE_ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;
export type TAiMessageRole = typeof AI_MESSAGE_ROLE[keyof typeof AI_MESSAGE_ROLE];

export const AI_RAG_OWNER_TYPE = {
  TRAINING_SESSION: 'training_session',
  WORKOUT: 'workout',
  EXCERCISE: 'excercise',
  MUSCLE_GROUP: 'muscle_group',
  MESSAGE: 'message',
} as const;
export type TAiRagOwnerType = typeof AI_RAG_OWNER_TYPE[keyof typeof AI_RAG_OWNER_TYPE];

export const AI_EVENT = {
  META: 'meta',
  REASONING: 'reasoning',
  CONTENT: 'content',
  CITATIONS: 'citations',
  USAGE: 'usage',
  DONE: 'done',
  ERROR: 'error',
} as const;
export type TAiEvent = typeof AI_EVENT[keyof typeof AI_EVENT];

export interface IAiCitation {
  type: TAiRagOwnerType;
  id: string;
  score: number;
  snippet: string;
}

export interface IAiUsage {
  promptTokens: number;
  completionTokens: number;
  ragHits: number;
  compressed: boolean;
}

export interface IAiError {
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * Provider 协议族。
 * 后续接 DeepSeek / 通义 / vllm 只需新增对应 adapter,不动 ModelRegistry 与业务调用方。
 */
export const MODEL_PROTOCOL = {
  ANTHROPIC: 'anthropic',
  OPENAI_COMPATIBLE: 'openai-compatible',
} as const;
export type TModelProtocol = typeof MODEL_PROTOCOL[keyof typeof MODEL_PROTOCOL];

/**
 * Provider 能力位 — 业务调用方按能力选择 provider,不绑死 model 名。
 */
export const MODEL_CAPABILITY = {
  STREAM_CHAT: 'streamChat',
  SUMMARIZE: 'summarize',
  EMBED: 'embed',
} as const;
export type TModelCapability = typeof MODEL_CAPABILITY[keyof typeof MODEL_CAPABILITY];

/**
 * 流式对话统一入参(provider 由 ModelRegistry 解析)。
 */
export interface IStreamChatParams {
  system: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  /** 走 provider 的 reasoning/thinking 通道;若 provider 不支持,adapter 内部降级 */
  thinking?: boolean;
}

export type TStreamChatEventType = 'reasoning' | 'content' | 'usage' | 'done' | 'error';

export interface IStreamChatEvent {
  type: TStreamChatEventType;
  delta?: string;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
  error?: IAiError;
}

export interface ISummarizeParams {
  prompt: string;
  maxTokens?: number;
  format?: 'freeform' | 'structured';
}

export interface IEmbedParams {
  input: string | string[];
}

/**
 * Provider 接口契约。provider adapter 必须实现本接口的全部声明方法;
 * 不支持的能力通过 capabilities 数组标注,ModelRegistry 调用前会校验。
 */
export interface IModelProvider {
  readonly id: string;
  readonly protocol: TModelProtocol;
  readonly capabilities: TModelCapability[];
  readonly embedDim?: number;

  streamChat(params: IStreamChatParams, signal?: AbortSignal): AsyncIterable<IStreamChatEvent>;
  summarize(params: ISummarizeParams, signal?: AbortSignal): Promise<string>;
  embed(params: IEmbedParams, signal?: AbortSignal): Promise<number[][]>;
}