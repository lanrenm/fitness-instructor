import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 10;

/**
 * 密码加密（使用 bcrypt 算法，自动处理盐值）
 * @param password 明文密码
 * @returns 加密后的密码哈希（包含盐值）
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 密码验证
 * @param password 用户输入的明文密码
 * @param hashedPassword 数据库中存储的哈希密码
 * @returns 是否匹配
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * 生成密码重置令牌
 * @returns 随机令牌
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 生成邮箱验证令牌
 * @returns 随机令牌
 */
export function generateEmailToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
