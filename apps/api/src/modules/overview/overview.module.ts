import { Module } from '@nestjs/common';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { DatabaseService } from '../../database';

@Module({
  controllers: [OverviewController],
  providers: [OverviewService, DatabaseService],
  exports: [OverviewService],
})
export class OverviewModule {}
