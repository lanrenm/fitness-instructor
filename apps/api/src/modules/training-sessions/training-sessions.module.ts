import { Module } from '@nestjs/common';
import { TrainingSessionsController } from './training-sessions.controller';
import { TrainingSessionsService } from './training-sessions.service';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [TrainingSessionsController],
  providers: [TrainingSessionsService],
  exports: [TrainingSessionsService],
})
export class TrainingSessionsModule {}
