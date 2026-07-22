import { Module } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { MuscleGroupsController } from './muscle-groups.controller';
import { MuscleGroupsService } from './muscle-groups.service';

@Module({
  controllers: [MuscleGroupsController],
  providers: [MuscleGroupsService, DatabaseService],
  exports: [MuscleGroupsService],
})
export class MuscleGroupsModule {}
