import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './lib/app.controller';
import { AppService } from './lib/app.service';
import { DatabaseService } from './database';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { AuthModule } from './modules/auth/auth.module';
import { OverviewModule } from './modules/overview/overview.module';
import { MuscleGroupsModule } from './modules/muscle-groups/muscle-groups.module';
import { ExcercisesModule } from './modules/excercises/excercises.module';
import { ModelsModule } from './modules/models/models.module';
import { AiModule } from './modules/ai/ai.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';
import { TrainingSessionsModule } from './modules/training-sessions/training-sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    OverviewModule,
    ModelsModule,
    AiModule,
    MuscleGroupsModule,
    ExcercisesModule,
    WorkoutsModule,
    TrainingSessionsModule,
  ],
  controllers: [AppController, UsersController],
  providers: [AppService, DatabaseService, UsersService],
})
export class AppModule {}
