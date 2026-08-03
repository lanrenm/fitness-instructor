/**
 * NestJS 侧 ModelProvider 类型 re-export,便于 service 通过 DI 类型安全注入。
 */
export type {
  IModelProvider,
  IStreamChatParams,
  IStreamChatEvent,
  ISummarizeParams,
  IEmbedParams,
  TStreamChatEventType,
} from '@fitness/shared-types/ai';

export { MODEL_CAPABILITY, MODEL_PROTOCOL } from '@fitness/shared-types/ai';
export type { TModelCapability, TModelProtocol } from '@fitness/shared-types/ai';
