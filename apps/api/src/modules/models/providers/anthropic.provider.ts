import Anthropic from '@anthropic-ai/sdk';
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
import { IAiError } from '@fitness/shared-types/ai';

export interface IAnthropicProviderConfig {
  id: string;
  baseUrl?: string;
  chatModel: string;
  summaryModel: string;
  embedModel: string;
  embedDim: number;
}

/**
 * Anthropic 协议 provider adapter.
 * 支持任意 Anthropic 兼容端点(默认 base url 可由 env 覆盖).
 * 注意:Anthropic SDK 没有原生 embeddings API,本期 embed() 抛 'not supported',
 * 由 OpenAI-compatible adapter 提供 embed 能力(若需).
 */
export class AnthropicProvider implements IModelProvider {
  readonly id: string;
  readonly protocol: TModelProtocol = 'anthropic';
  readonly capabilities: TModelCapability[];
  readonly embedDim?: number;

  readonly client: Anthropic;
  private readonly summaryModel: string;
  private readonly embedModel: string;

  constructor(opts: { apiKey: string; baseUrl?: string; config: IAnthropicProviderConfig }) {
    this.id = opts.config.id;
    this.summaryModel = opts.config.summaryModel;
    this.embedModel = opts.config.embedModel;
    this.embedDim = opts.config.embedDim;

    const caps: TModelCapability[] = [MODEL_CAPABILITY.STREAM_CHAT, MODEL_CAPABILITY.SUMMARIZE];
    if (opts.config.embedModel) caps.push(MODEL_CAPABILITY.EMBED);
    this.capabilities = caps;

    this.client = new Anthropic({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl,
    });
  }

  async *streamChat(
    params: IStreamChatParams,
    signal?: AbortSignal,
  ): AsyncIterable<IStreamChatEvent> {
    const model = this.id;
    const stream = this.client.messages.stream(
      {
        model,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.7,
        system: params.system,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })) as any,
      },
      { signal: signal as any },
    );

    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let finishReason: string | undefined;

    for await (const event of stream as any) {
      if (event?.type === 'content_block_delta') {
        const d = event.delta;
        if (d?.type === 'thinking_delta' && d.thinking) {
          yield { type: 'reasoning', delta: d.thinking };
        } else if (d?.type === 'text_delta' && d.text) {
          yield { type: 'content', delta: d.text };
        }
      } else if (event?.type === 'message_start' && event.message?.usage) {
        promptTokens = event.message.usage.input_tokens;
      } else if (event?.type === 'message_delta') {
        if (event.usage?.output_tokens != null) completionTokens = event.usage.output_tokens;
        if (event.delta?.stop_reason) finishReason = event.delta.stop_reason;
      } else if (event?.type === 'error') {
        const e: IAiError = mapAnthropicError(event.error);
        yield { type: 'error', error: e };
        return;
      } else if (event?.type === 'message_stop') {
        yield {
          type: 'usage',
          promptTokens: promptTokens ?? 0,
          completionTokens: completionTokens ?? 0,
        };
        yield { type: 'done', finishReason };
        return;
      }
    }
  }

  async summarize(params: ISummarizeParams, signal?: AbortSignal): Promise<string> {
    const resp = await this.client.messages.create(
      {
        model: this.summaryModel,
        max_tokens: params.maxTokens ?? 1024,
        messages: [{ role: 'user', content: params.prompt }],
      },
      { signal: signal as any },
    );
    const block = resp.content?.[0];
    return block && (block as any).type === 'text' ? (block as any).text : '';
  }

  async embed(_params: IEmbedParams): Promise<number[][]> {
    if (!this.embedModel) {
      throw new Error(`embed not supported by provider ${this.id} (no embed model configured)`);
    }
    throw new Error('Anthropic SDK has no embeddings API; configure OpenAI-compatible provider for embed');
  }
}

function mapAnthropicError(err: any): IAiError {
  const type = err?.type ?? 'unknown_error';
  const retryable =
    type === 'overloaded_error' ||
    type === 'rate_limit_error' ||
    type === 'timeout_error' ||
    type === 'api_error';
  return { code: type, message: err?.message ?? 'anthropic error', retryable };
}
