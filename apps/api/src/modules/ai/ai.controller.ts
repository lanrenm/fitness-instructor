import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiConversationRepository } from './ai-conversation.repository';
import { AiMessageRepository } from './ai-message.repository';
import { AiChatService } from './ai-chat.service';
import { SearchService } from './search.service';
import { CreateAiConversationDto } from './dto/create-conversation.dto';
import { UpdateAiConversationDto } from './dto/update-conversation.dto';
import { SendAiMessageDto } from './dto/send-message.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly convRepo: AiConversationRepository,
    private readonly messageRepo: AiMessageRepository,
    private readonly chat: AiChatService,
    private readonly search: SearchService,
  ) {}

  @Post('conversations')
  async create(@Req() req: any, @Body() dto: CreateAiConversationDto) {
    const userId = req.user.userId;
    return this.convRepo.create(userId, {
      model: dto.model ?? process.env.AI_CHAT_MODEL ?? 'MiniMax-M3',
      temperature: dto.temperature ?? Number(process.env.AI_CHAT_TEMPERATURE ?? 0.7),
    });
  }

  @Get('conversations')
  async list(
    @Req() req: any,
    @Query('limit') limit = '20',
    @Query('cursor') cursor?: string,
  ) {
    return this.convRepo.listForUser(req.user.userId, {
      limit: Math.min(Number(limit) || 20, 100),
      cursor: cursor ?? null,
    });
  }

  @Get('conversations/:id')
  async detail(@Req() req: any, @Param('id') id: string) {
    const conv = await this.convRepo.assertOwned(id, req.user.userId);
    const messages = await this.messageRepo.getForConversation(id);
    return { ...conv, messages };
  }

  @Patch('conversations/:id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAiConversationDto,
  ) {
    await this.convRepo.assertOwned(id, req.user.userId);
    return this.convRepo.update(id, dto);
  }

  @Delete('conversations/:id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.convRepo.assertOwned(id, req.user.userId);
    const ok = await this.convRepo.delete(id);
    return { deleted: ok };
  }

  @Post('conversations/:id/messages')
  async stream(
    @Req() req: any,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: SendAiMessageDto,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const subscription = this.chat
      .stream(req.user.userId, id, body)
      .subscribe({
        next: (event) => {
          res.write(`event: ${event.type}\n`);
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        },
        error: (err) => {
          const payload = { type: 'error', message: String(err?.message ?? err) };
          res.write(`event: error\n`);
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
          res.end();
        },
        complete: () => {
          res.end();
        },
      });

    req.on('close', () => {
      subscription.unsubscribe();
    });
  }

  @Get('search')
  async searchHits(
    @Req() req: any,
    @Query('q') q: string,
    @Query('limit') limit = '20',
  ) {
    return this.search.search(
      req.user.userId,
      q,
      Math.min(Number(limit) || 20, 50),
    );
  }

  @Post('admin/embeddings/rebuild')
  async rebuildEmbeddings(@Body() body: { ownerTypes?: string[] }) {
    return { enqueued: true, ownerTypes: body.ownerTypes ?? ['all'] };
  }
}