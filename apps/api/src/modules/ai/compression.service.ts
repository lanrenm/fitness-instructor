import { Injectable, Logger } from '@nestjs/common';
import { AiConversationRepository } from './ai-conversation.repository';
import { AiMessageRepository } from './ai-message.repository';
import { ModelRegistry } from '../models/model-registry.service';
import { MODEL_CAPABILITY } from '../models/model-provider.interface';

@Injectable()
export class CompressionService {
  private readonly logger = new Logger(CompressionService.name);

  constructor(
    private readonly registry: ModelRegistry,
    private readonly messageRepo: AiMessageRepository,
    private readonly convRepo: AiConversationRepository,
  ) {}

  async run(conversationId: string): Promise<void> {
    try {
      const messages = await this.messageRepo.listUncompressed(conversationId);
      if (messages.length === 0) return;

      const prompt = [
        '你是摘要助手,把以下对话压缩为结构化摘要(JSON):{userGoals, keyConclusions, pendingQuestions}',
        '',
        ...messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`),
      ].join('\n');

      const provider = this.registry.resolveForCapability(MODEL_CAPABILITY.SUMMARIZE, {
        preferredId: process.env.AI_CHAT_SUMMARY_MODEL,
        fallback: process.env.AI_CHAT_MODEL,
      });
      const summary = await provider.summarize({ prompt, format: 'structured' });

      await this.convRepo.update(conversationId, { summary });
      await this.messageRepo.markCompressed(messages.map((m) => m.id));
    } catch (err: any) {
      this.logger.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          conversationId,
          err: err?.message ?? String(err),
        }),
      );
    }
  }
}