import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { RagService } from './rag.service';
import { EmbeddingsService } from './embeddings.service';
import { AiMessageRepository } from './ai-message.repository';
import { AiConversationRepository } from './ai-conversation.repository';
import { ModelRegistry } from '../models/model-registry.service';
import { MODEL_CAPABILITY } from '../models/model-provider.interface';
import { CompressionService } from './compression.service';
import {
  AI_EVENT,
  IAiCitation,
  IAiError,
  IAiUsage,
  AI_RAG_OWNER_TYPE,
} from '@fitness/shared-types/ai';

interface IChatRequest {
  content: string;
  regenerate?: boolean;
  model?: string;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly windowSize: number;
  private readonly cooldownMs: number;
  private lastCompressedAt = new Map<string, number>();

  constructor(
    private readonly rag: RagService,
    private readonly embeddings: EmbeddingsService,
    private readonly messageRepo: AiMessageRepository,
    private readonly convRepo: AiConversationRepository,
    private readonly registry: ModelRegistry,
    private readonly compression: CompressionService,
    private readonly cfg: ConfigService,
  ) {
    this.windowSize = Number(this.cfg.get('AI_CHAT_WINDOW_SIZE') ?? 6);
    this.cooldownMs = Number(this.cfg.get('AI_CHAT_COMPRESS_COOLDOWN_MS') ?? 300000);
  }

  stream(
    userId: string,
    conversationId: string,
    req: IChatRequest,
  ): Observable<{ type: string; [k: string]: any }> {
    return new Observable((subscriber) => {
      const abort = new AbortController();
      let assistantMessageId: string | undefined;

      (async () => {
        try {
          const conv = await this.convRepo.assertOwned(conversationId, userId);
          const ragHits = await this.rag.retrieve(userId, req.content);
          const recent = await this.messageRepo.getRecentForConversation(
            conversationId,
            this.windowSize,
          );

          const system = this.buildSystemBlock(ragHits, conv.summary ?? null);

          const provider = this.registry.resolveForCapability(MODEL_CAPABILITY.STREAM_CHAT, {
            preferredId: req.model ?? conv.model ?? process.env.AI_CHAT_MODEL,
            fallback: process.env.AI_CHAT_MODEL,
          });

          let accContent = '';
          let promptTokens = 0;
          let completionTokens = 0;
          let usage: IAiUsage | null = null;

          subscriber.next({ type: AI_EVENT.META, conversationId });

          for await (const ev of provider.streamChat(
            {
              system,
              messages: [
                ...recent.map((m) => ({ role: m.role as any, content: m.content })),
                { role: 'user', content: req.content },
              ],
              temperature: conv.temperature,
              thinking: true,
            },
            abort.signal,
          )) {
            if (ev.type === 'content') {
              accContent += ev.delta ?? '';
              subscriber.next({ type: AI_EVENT.CONTENT, delta: ev.delta });
            } else if (ev.type === 'reasoning') {
              subscriber.next({ type: AI_EVENT.REASONING, delta: ev.delta });
            } else if (ev.type === 'usage') {
              promptTokens = ev.promptTokens ?? 0;
              completionTokens = ev.completionTokens ?? 0;
            } else if (ev.type === 'done') {
              usage = {
                promptTokens,
                completionTokens,
                ragHits: ragHits.length,
                compressed: false,
              };
              subscriber.next({ type: AI_EVENT.CITATIONS, hits: ragHits });
              subscriber.next({ type: AI_EVENT.USAGE, ...usage });
              subscriber.next({ type: AI_EVENT.DONE, finishReason: ev.finishReason });
            } else if (ev.type === 'error') {
              const err: IAiError = ev.error!;
              subscriber.next({ type: AI_EVENT.ERROR, error: err });
              subscriber.complete();
              return;
            }
          }

          // Persist user + assistant messages (FIX: capture user id for correct embedding)
          const userRow = await this.messageRepo.appendMessage(conversationId, {
            role: 'user',
            content: req.content,
          });
          const assistantRow = await this.messageRepo.appendMessage(conversationId, {
            role: 'assistant',
            content: accContent,
            ragContext: ragHits,
            providerId: provider.id,
            promptTokens,
            completionTokens,
          });
          assistantMessageId = assistantRow.id;

          // Write embeddings (one per message id, for separate semantic retrieval)
          await Promise.all([
            this.embeddings.upsert(
              AI_RAG_OWNER_TYPE.MESSAGE,
              userRow.id,
              req.content,
            ),
            this.embeddings.upsert(
              AI_RAG_OWNER_TYPE.MESSAGE,
              assistantMessageId,
              accContent,
            ),
          ]).catch((e) =>
            this.logger.error(`embedding upsert failed: ${e?.message}`),
          );

          const count = await this.messageRepo.countForConversation(conversationId);
          const last = this.lastCompressedAt.get(conversationId) ?? 0;
          if (count > this.windowSize && Date.now() - last > this.cooldownMs) {
            this.lastCompressedAt.set(conversationId, Date.now());
            setImmediate(() => this.compression.run(conversationId));
          }

          subscriber.complete();
        } catch (err: any) {
          subscriber.next({
            type: AI_EVENT.ERROR,
            error: {
              code: 'STREAM_ERROR',
              message: err?.message ?? 'unknown',
              retryable: false,
            },
          });
          subscriber.complete();
        }
      })();

      return () => abort.abort();
    });
  }

  private buildSystemBlock(hits: IAiCitation[], summary: string | null): string {
    const head = '你是用户的健身顾问 MiniMax-M3,语气专业克制。';
    const rag =
      hits.length === 0
        ? ''
        : '\n以下是该用户近期训练/动作知识(RAG 自动检索,可能不完整):\n\n' +
          hits
            .map(
              (h, i) => `[${i + 1}] (${h.type}) ${h.snippet}`,
            )
            .join('\n') +
          '\n\n仅基于以上事实回答,涉及训练数据时不得编造。';
    const summ = summary ? `\n[历史摘要] ${summary}` : '';
    return head + rag + summ;
  }
}