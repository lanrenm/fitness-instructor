import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTrainingSessionDto {
  @IsString() name!: string;
  @IsDateString() startedAt!: string;
  @IsInt() @Min(1) @Max(600) durationMinutes!: number;
  @IsInt() @Min(0) @Max(200) exerciseCount!: number;
  @IsInt() @Min(0) @Max(100) intensity!: number;
  @IsInt() @Min(0) @Max(10000) caloriesBurned!: number;
  @IsOptional() @IsString() notes?: string;
}
