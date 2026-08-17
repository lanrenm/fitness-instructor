import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database';

export interface IAiConversationRow {
  id: string;
  userId: string;
  title: string | null;
  summary: string | null;
  model: string;
  temperature: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAiConversationCreateInput {
  model: string;
  temperature: number;
}

export interface IAiConversationUpdateInput {
  title?: string | null;
  model?: string;
  temperature?: number;
  summary?: string | null;
}

@Injectable()
export class AiConversationRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(userId: string, input: IAiConversationCreateInput): Promise<IAiConversationRow> {
    const { rows } = await this.db
      .getPool()
      .query(
        `INSERT INTO "AiConversation"(id, "userId", model, temperature)
         VALUES (gen_random_uuid()::text, $1, $2, $3) RETURNING *`,
        [userId, input.model, input.temperature],
      );
    return rows[0];
  }

  async findById(id: string): Promise<IAiConversationRow | null> {
    const { rows } = await this.db
      .getPool()
      .query(`SELECT * FROM "AiConversation" WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async assertOwned(id: string, userId: string): Promise<IAiConversationRow> {
    const row = await this.findById(id);
    if (!row || row.userId !== userId) {
      throw new ForbiddenException(`conversation ${id} not found`);
    }
    return row;
  }

  async listForUser(
    userId: string,
    opts: { limit: number; cursor: string | null },
  ): Promise<IAiConversationRow[]> {
    const { rows } = await this.db.getPool().query(
      `SELECT * FROM "AiConversation"
       WHERE "userId" = $1
         ${opts.cursor ? `AND "updatedAt" < (SELECT "updatedAt" FROM "AiConversation" WHERE id = $2)` : ''}
       ORDER BY "updatedAt" DESC
       LIMIT $${opts.cursor ? '3' : '2'}`,
      opts.cursor ? [userId, opts.cursor, opts.limit] : [userId, opts.limit],
    );
    return rows;
  }

  async update(id: string, input: IAiConversationUpdateInput): Promise<IAiConversationRow> {
    const sets: string[] = [];
    const args: any[] = [];
    let i = 1;
    if (input.title !== undefined) {
      sets.push(`title = $${i++}`);
      args.push(input.title);
    }
    if (input.model !== undefined) {
      sets.push(`model = $${i++}`);
      args.push(input.model);
    }
    if (input.temperature !== undefined) {
      sets.push(`temperature = $${i++}`);
      args.push(input.temperature);
    }
    if (input.summary !== undefined) {
      sets.push(`summary = $${i++}`);
      args.push(input.summary);
    }
    if (sets.length === 0) return (await this.findById(id))!;
    sets.push(`"updatedAt" = NOW()`);
    args.push(id);
    const { rows } = await this.db
      .getPool()
      .query(
        `UPDATE "AiConversation" SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        args,
      );
    return rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const r = await this.db.getPool().query(`DELETE FROM "AiConversation" WHERE id = $1`, [id]);
    return (r.rowCount ?? 0) > 0;
  }
}
