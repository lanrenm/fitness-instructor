import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import pg from 'pg';

const { Pool } = pg;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: pg.Pool;

  constructor() {
    this.pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://fitness:fitness0520@postgres:5432/fitness_instructor',
    });
  }

  async onModuleInit() {
    try {
      const client = await this.pool.connect();
      console.log('✅ Database connected successfully');
      client.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }

  getPool() {
    return this.pool;
  }
}
