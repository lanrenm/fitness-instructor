import { Module } from '@nestjs/common';
import { AppController } from './lib/app.controller';
import { AppService } from './lib/app.service';
import { DatabaseService } from './database';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AppController, UsersController],
  providers: [AppService, DatabaseService, UsersService],
})
export class AppModule {}
