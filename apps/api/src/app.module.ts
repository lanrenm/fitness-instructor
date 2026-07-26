import { Module } from '@nestjs/common';
import { AppController } from './lib/app.controller';
import { AppService } from './lib/app.service';
import { DatabaseService } from './database';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { AuthModule } from './modules/auth/auth.module';
import { OverviewModule } from './modules/overview/overview.module';
import { MuscleGroupsModule } from './modules/muscle-groups/muscle-groups.module';
import { ExcercisesModule } from './modules/excercises/excercises.module';

@Module({
  imports: [AuthModule, OverviewModule, MuscleGroupsModule, ExcercisesModule],
  controllers: [AppController, UsersController],
  providers: [AppService, DatabaseService, UsersService],
})
export class AppModule {}
