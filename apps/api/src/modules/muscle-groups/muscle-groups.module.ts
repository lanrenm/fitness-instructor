import { Module } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { AiModule } from '../ai/ai.module';
import { MuscleGroupsController } from './muscle-groups.controller';
import { MuscleGroupsService } from './muscle-groups.service';

@Module({
  imports: [AiModule],
  controllers: [MuscleGroupsController],
  providers: [MuscleGroupsService, DatabaseService],
  exports: [MuscleGroupsService],
})
export class MuscleGroupsModule {}
