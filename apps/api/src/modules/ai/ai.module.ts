import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiChatService } from './ai-chat.service';
import { AiConversationRepository } from './ai-conversation.repository';
import { AiMessageRepository } from './ai-message.repository';
import { RagService } from './rag.service';
import { SearchService } from './search.service';
import { CompressionService } from './compression.service';
import { EmbeddingsService } from './embeddings.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [
    AiChatService,
    AiConversationRepository,
    AiMessageRepository,
    RagService,
    SearchService,
    CompressionService,
    EmbeddingsService,
  ],
  exports: [EmbeddingsService],
})
export class AiModule {}