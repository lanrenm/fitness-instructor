import {
  IEmbedParams,
  IModelProvider,
  IStreamChatEvent,
  IStreamChatParams,
  ISummarizeParams,
  MODEL_CAPABILITY,
  TModelCapability,
  TModelProtocol,
} from '../model-provider.interface';

/**
 * OpenAI-compatible adapter stub.
 *
 * Phase-1 不启用 — 仅占扩展位。
 * 启用时需:1) 安装 openai SDK;2) 实现 streamChat(转 SSE / OpenAI delta 事件);
 * 3) 实现 summarize 与 embed;4) 在 ModelConfigLoader 启用 openai-compatible 协议。
 */
export interface IOpenAICompatibleConfig {
  id: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  summaryModel: string;
  embedModel: string;
  embedDim: number;
}

export class OpenAICompatibleProvider implements IModelProvider {
  readonly id: string;
  readonly protocol: TModelProtocol = 'openai-compatible';
  readonly capabilities: TModelCapability[] = [];
  readonly embedDim?: number;

  // biome-ignore lint/correctness/noUnusedVariables: phase-1 stub
  constructor(_opts: IOpenAICompatibleConfig) {
    this.id = _opts.id;
    this.embedDim = _opts.embedDim;
    throw new Error(
      `OpenAI-compatible provider ${_opts.id} is a Phase-1 stub. Implementation deferred; ` +
        `see apps/api/src/modules/models/providers/openai-compatible.provider.ts`,
    );
  }

  async *streamChat(_p: IStreamChatParams, _s?: AbortSignal): AsyncIterable<IStreamChatEvent> {
    throw new Error('not implemented');
  }

  async summarize(_p: ISummarizeParams, _s?: AbortSignal): Promise<string> {
    throw new Error('not implemented');
  }

  async embed(_p: IEmbedParams, _s?: AbortSignal): Promise<number[][]> {
    throw new Error('not implemented');
  }
}

// Keep MODEL_CAPABILITY import referenced so this file stays syntactically valid until implementation.
export const _KEEP_REFERENCE = MODEL_CAPABILITY;
