import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database';
import { hashPassword, verifyPassword } from '../../utils/password';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
    private jwtService: JwtService,
  ) {}

  async validateUser(phonenumber: string, password: string) {
    const result = await this.db.query(
      'SELECT * FROM "User" WHERE phonenumber = $1',
      [phonenumber],
    );
    const user = result.rows[0];
    if (!user) return null;

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) return null;

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.phonenumber, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('手机号或密码错误');
    }
    return this.generateTokens(user);
  }

  async register(registerDto: RegisterDto) {
    // 检查手机号是否已存在
    const existingPhone = await this.db.query(
      'SELECT id FROM "User" WHERE phonenumber = $1',
      [registerDto.phonenumber],
    );
    if (existingPhone.rows.length > 0) {
      throw new ConflictException('该手机号已被注册');
    }

    // 创建用户
    const hashedPassword = await hashPassword(registerDto.password);
    const id = require('crypto').randomUUID();
    // User.email 在 schema 里是 NOT NULL @unique，但前端 RegisterForm
    // 不收集 email（只用手机号）。合成 `<phone>@phone.local` 满足
    // NOT NULL + @unique（phonenumber 已 unique，所以 email 也 unique）。
    // 后续如果前端支持邮箱登录，去掉这行并在 DTO 加 email 字段。
    const synthesizedEmail = `${registerDto.phonenumber}@phone.local`;
    const result = await this.db.query(
      `INSERT INTO "User" (id, email, phonenumber, password, name, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [id, synthesizedEmail, registerDto.phonenumber, hashedPassword, registerDto.name],
    );

    return this.generateTokens(result.rows[0]);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
      });
      const result = await this.db.query(
        'SELECT * FROM "User" WHERE id = $1',
        [payload.sub],
      );
      if (result.rows.length === 0) {
        throw new UnauthorizedException('用户不存在');
      }
      return this.generateTokens(result.rows[0]);
    } catch {
      throw new UnauthorizedException('Refresh token 无效或已过期');
    }
  }

  async getUser(userId: string) {
    const result = await this.db.query(
      'SELECT id, email, phonenumber, name, "createdAt", "updatedAt" FROM "User" WHERE id = $1',
      [userId],
    );
    if (result.rows.length === 0) {
      throw new UnauthorizedException('用户不存在');
    }
    return result.rows[0];
  }

  private generateTokens(user: any) {
    const payload = { sub: user.id, phonenumber: user.phonenumber, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        phonenumber: user.phonenumber,
        name: user.name,
      },
    };
  }
}