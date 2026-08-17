import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OverviewService } from './overview.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get('stats')
  async getStats(@CurrentUser() user: { userId: string }) {
    return this.overviewService.getStats(user.userId);
  }

  @Get('intensity')
  async getIntensity(@CurrentUser() user: { userId: string }) {
    return this.overviewService.getIntensity(user.userId);
  }

  @Get('recent-sessions')
  async getRecentSessions(
    @CurrentUser() user: { userId: string },
    @Query('limit') limitRaw?: string,
  ) {
    const parsed = limitRaw ? parseInt(limitRaw, 10) : 3;
    const safe = Number.isNaN(parsed) ? 3 : Math.min(50, Math.max(1, parsed));
    return this.overviewService.getRecentSessions(user.userId, safe);
  }
}
