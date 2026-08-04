import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Global so every module shares one DatabaseService — and therefore one pg
 * connection pool. Registering DatabaseService as a plain provider per module
 * gives each module its own pool (default max 10 connections each).
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
