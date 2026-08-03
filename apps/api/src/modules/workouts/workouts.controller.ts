import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkoutsService } from './workouts.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';

@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(private readonly svc: WorkoutsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateWorkoutDto) {
    return this.svc.create(req.user.userId, dto);
  }

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.userId);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateWorkoutDto) {
    return this.svc.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.userId, id);
  }
}