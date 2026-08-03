import { Module } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { TrainingSessionsController } from './training-sessions.controller';
import { TrainingSessionsService } from './training-sessions.service';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [TrainingSessionsController],
  providers: [TrainingSessionsService, DatabaseService],
  exports: [TrainingSessionsService],
})
export class TrainingSessionsModule {}
