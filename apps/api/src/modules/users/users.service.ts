import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database';

@Injectable()
export class UsersService {
  constructor(private db: DatabaseService) {}

  async findAll() {
    const result = await this.db.query(
      'SELECT * FROM "User" ORDER BY "createdAt" DESC',
    );
    return result.rows;
  }

  async create(data: { email: string; name?: string }) {
    const id = require('crypto').randomUUID();
    const result = await this.db.query(
      'INSERT INTO "User" (id, email, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [id, data.email, data.name || null],
    );
    return result.rows[0];
  }
}
