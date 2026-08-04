import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { MuscleGroupsController } from './muscle-groups.controller';
import { MuscleGroupsService } from './muscle-groups.service';

@Module({
  imports: [AiModule],
  controllers: [MuscleGroupsController],
  providers: [MuscleGroupsService],
  exports: [MuscleGroupsService],
})
export class MuscleGroupsModule {}
