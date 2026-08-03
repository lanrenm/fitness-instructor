import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TrainingSessionsService } from './training-sessions.service';
import { CreateTrainingSessionDto } from './dto/create-training-session.dto';
import { UpdateTrainingSessionDto } from './dto/update-training-session.dto';

@Controller('training-sessions')
@UseGuards(JwtAuthGuard)
export class TrainingSessionsController {
  constructor(private readonly svc: TrainingSessionsService) {}

  @Post() create(@Req() req: any, @Body() dto: CreateTrainingSessionDto) {
    return this.svc.create(req.user.userId, dto);
  }

  @Get() list(@Req() req: any, @Query('limit') limit?: string) {
    return this.svc.list(req.user.userId, Math.min(Number(limit) || 50, 200));
  }

  @Get(':id') detail(@Req() req: any, @Param('id') id: string) {
    return this.svc.findById(req.user.userId, id);
  }

  @Patch(':id') update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTrainingSessionDto,
  ) {
    return this.svc.update(req.user.userId, id, dto);
  }

  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.userId, id);
  }
}
