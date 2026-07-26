import { IsString, MinLength, IsInt, Min, Max, IsArray, IsOptional, IsBoolean, ArrayNotEmpty } from 'class-validator';

export class CreateExcerciseDto {
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  name: string;

  @IsInt()
  @Min(1)
  @Max(6)
  category: number;

  @IsInt()
  @Min(1)
  @Max(3)
  difficulty: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  @IsArray()
  @ArrayNotEmpty({ message: '至少选择一个目标肌群' })
  @IsString({ each: true })
  muscleGroupIds: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
