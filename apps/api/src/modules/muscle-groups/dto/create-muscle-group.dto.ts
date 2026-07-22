import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMuscleGroupDto {
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
