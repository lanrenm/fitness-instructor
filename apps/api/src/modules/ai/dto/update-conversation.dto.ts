import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateAiConversationDto } from './create-conversation.dto';

export class UpdateAiConversationDto extends PartialType(
  CreateAiConversationDto,
) {
  @IsOptional()
  @IsString()
  title?: string;
}
