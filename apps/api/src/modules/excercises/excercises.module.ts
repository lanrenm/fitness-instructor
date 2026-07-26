import { Module } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { ExcercisesController } from './excercises.controller';
import { ExcercisesService } from './excercises.service';

@Module({
  controllers: [ExcercisesController],
  providers: [ExcercisesService, DatabaseService],
  exports: [ExcercisesService],
})
export class ExcercisesModule {}
