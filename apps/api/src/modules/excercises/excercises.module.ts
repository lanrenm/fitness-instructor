import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ExcercisesController } from './excercises.controller';
import { ExcercisesService } from './excercises.service';

@Module({
  imports: [AiModule],
  controllers: [ExcercisesController],
  providers: [ExcercisesService],
  exports: [ExcercisesService],
})
export class ExcercisesModule {}
