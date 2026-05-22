import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(11, { message: '请输入有效的手机号' })
  phonenumber: string;

  @IsString()
  @MinLength(6, { message: '密码至少需要6个字符' })
  password: string;
}