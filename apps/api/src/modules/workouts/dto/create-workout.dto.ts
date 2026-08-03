import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  workoutExcerciseIds?: string[];
}