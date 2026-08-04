import { Module } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService, DatabaseService],
})
export class WorkoutsModule {}