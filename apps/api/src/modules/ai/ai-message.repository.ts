import type { IAiCitation, TAiMessageRole } from '@fitness/shared-types/ai';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database';

export interface IAiMessageRow {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  reasoning: string | null;
  ragContext: IAiCitation[] | null;
  providerId: string | null;
  promptTokens: number;
  completionTokens: number;
  compressed: boolean;
  createdAt: Date;
}

export interface IAiMessageInsertInput {
  role: TAiMessageRole;
  content: string;
  reasoning?: string | null;
  ragContext?: IAiCitation[];
  providerId?: string | null;
  promptTokens?: number;
  completionTokens?: number;
}

@Injectable()
export class AiMessageRepository {
  constructor(private readonly db: DatabaseService) {}

  async appendMessage(conversationId: string, input: IAiMessageInsertInput): Promise<IAiMessageRow> {
    const { rows } = await this.db.getPool().query(
      `INSERT INTO "AiMessage"(id, "conversationId", role, content, reasoning, "ragContext", "providerId", "promptTokens", "completionTokens")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        conversationId,
        input.role,
        input.content,
        input.reasoning ?? null,
        input.ragContext ? JSON.stringify(input.ragContext) : null,
        input.providerId ?? null,
        input.promptTokens ?? 0,
        input.completionTokens ?? 0,
      ],
    );
    return rows[0];
  }

  async getRecentForConversation(conversationId: string, limit: number): Promise<IAiMessageRow[]> {
    const { rows } = await this.db.getPool().query(
      `SELECT * FROM "AiMessage"
       WHERE "conversationId" = $1 AND "compressed" = false
       ORDER BY "createdAt" DESC
       LIMIT $2`,
      [conversationId, limit],
    );
    return rows;
  }

  async getForConversation(conversationId: string, sinceId?: string): Promise<IAiMessageRow[]> {
    if (sinceId) {
      const { rows } = await this.db.getPool().query(
        `SELECT * FROM "AiMessage"
         WHERE "conversationId" = $1
           AND "createdAt" > (SELECT "createdAt" FROM "AiMessage" WHERE id = $2)
         ORDER BY "createdAt" ASC`,
        [conversationId, sinceId],
      );
      return rows;
    }
    const { rows } = await this.db.getPool().query(
      `SELECT * FROM "AiMessage" WHERE "conversationId" = $1 ORDER BY "createdAt" ASC`,
      [conversationId],
    );
    return rows;
  }

  async markCompressed(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { rowCount } = await this.db.getPool().query(
      `UPDATE "AiMessage" SET "compressed" = true WHERE id = ANY($1::text[])`,
      [ids],
    );
    return rowCount ?? 0;
  }

  async listUncompressed(conversationId: string): Promise<IAiMessageRow[]> {
    const { rows } = await this.db.getPool().query(
      `SELECT * FROM "AiMessage"
       WHERE "conversationId" = $1 AND "compressed" = false
       ORDER BY "createdAt" ASC`,
      [conversationId],
    );
    return rows;
  }

  async countForConversation(conversationId: string): Promise<number> {
    const { rows } = await this.db.getPool().query(
      `SELECT COUNT(*)::int AS c FROM "AiMessage" WHERE "conversationId" = $1`,
      [conversationId],
    );
    return rows[0]?.c ?? 0;
  }
}