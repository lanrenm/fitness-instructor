import { PartialType } from '@nestjs/mapped-types';
import { CreateExcerciseDto } from './create-excercise.dto';

export class UpdateExcerciseDto extends PartialType(CreateExcerciseDto) {}
