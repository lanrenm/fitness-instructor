import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateAiConversationDto {
  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'temperature 不能小于 0' })
  @Max(2, { message: 'temperature 不能大于 2' })
  temperature?: number;
}
