import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendAiMessageDto {
  @IsString()
  @MinLength(1, { message: '消息内容不能为空' })
  @MaxLength(8000, { message: '消息内容不能超过 8000 个字符' })
  content: string;

  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;

  @IsOptional()
  @IsString()
  model?: string;
}
