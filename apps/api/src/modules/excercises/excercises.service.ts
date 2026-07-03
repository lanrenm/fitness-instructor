import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database';

@Injectable()
export class ExcercisesService {
  constructor(private db: DatabaseService) {}

  async findAll() {
    const result = await this.db.query(
      'SELECT * FROM "Excercise" ORDER BY "createdAt" DESC',
    );
    return result.rows;
  }
}
