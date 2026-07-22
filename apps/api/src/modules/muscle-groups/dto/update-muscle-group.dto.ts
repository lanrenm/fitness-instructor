import { PartialType } from '@nestjs/mapped-types';
import { CreateMuscleGroupDto } from './create-muscle-group.dto';

export class UpdateMuscleGroupDto extends PartialType(CreateMuscleGroupDto) {}
