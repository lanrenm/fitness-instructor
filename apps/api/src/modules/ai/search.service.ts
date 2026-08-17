import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { EmbeddingsService } from './embeddings.service';

export interface ISearchHit {
  conversationId: string;
  messageId: string;
  snippet: string;
  score: number;
  matchType: 'keyword' | 'semantic';
}

@Injectable()
export class SearchService {
  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly db: DatabaseService,
  ) {}

  async search(userId: string, q: string, limit = 20): Promise<ISearchHit[]> {
    const [kwHits, vecHits] = await Promise.all([
      this.keywordSearch(userId, q),
      this.semanticSearch(userId, q),
    ]);
    const merged = this.rrf(kwHits, vecHits, 60).slice(0, limit);
    return merged.map((m) => ({
      conversationId: m.conversationId,
      messageId: m.messageId,
      snippet: m.snippet,
      score: m.score,
      matchType: m.matchType,
    }));
  }

  private async keywordSearch(userId: string, q: string) {
    try {
      const { rows } = await this.db.getPool().query(
        `SELECT m.id AS "messageId", m."conversationId" AS "conversationId",
                substring(m.content from 1 for 200) AS snippet,
                ts_rank(to_tsvector('simple', m.content), plainto_tsquery('simple', $1)) AS score
         FROM "AiMessage" m
         JOIN "AiConversation" c ON c.id = m."conversationId"
         WHERE c."userId" = $2
           AND to_tsvector('simple', m.content) @@ plainto_tsquery('simple', $1)
         ORDER BY score DESC LIMIT 30`,
        [q, userId],
      );
      return rows.map((r: any) => ({ ...r, matchType: 'keyword' }));
    } catch {
      const { rows } = await this.db.getPool().query(
        `SELECT m.id AS "messageId", m."conversationId" AS "conversationId",
                substring(m.content from 1 for 200) AS snippet,
                0.5 AS score
         FROM "AiMessage" m
         JOIN "AiConversation" c ON c.id = m."conversationId"
         WHERE c."userId" = $2 AND m.content ILIKE '%' || $1 || '%'
         ORDER BY m."createdAt" DESC LIMIT 30`,
        [q, userId],
      );
      return rows.map((r: any) => ({ ...r, matchType: 'keyword' }));
    }
  }

  private async semanticSearch(userId: string, q: string) {
    try {
      const vec = await this.embeddings.embedOne(q);
      const pgVec = '[' + vec.join(',') + ']';
      const { rows } = await this.db.getPool().query(
        `SELECT m.id AS "messageId", m."conversationId" AS "conversationId",
                substring(m.content from 1 for 200) AS snippet,
                1 - (e.embedding <=> $1::vector) AS score
         FROM "AiEmbedding" e
         JOIN "AiMessage" m ON m.id = e."ownerId" AND e."ownerType" = 'message'
         JOIN "AiConversation" c ON c.id = m."conversationId"
         WHERE c."userId" = $2
         ORDER BY e.embedding <=> $1::vector LIMIT 30`,
        [pgVec, userId],
      );
      return rows.map((r: any) => ({ ...r, matchType: 'semantic' }));
    } catch {
      return [];
    }
  }

  private rrf<T extends { messageId: string; score: number }>(a: T[], b: T[], k: number): T[] {
    const score = new Map<string, { hit: T; s: number; matchType: any }>();
    const meta = new Map<string, any>();
    a.forEach((h, i) => {
      score.set(h.messageId, { hit: h, s: 1 / (k + i + 1), matchType: (h as any).matchType });
      meta.set(h.messageId, (h as any).matchType);
    });
    b.forEach((h, i) => {
      const cur = score.get(h.messageId) ?? { hit: h, s: 0, matchType: (h as any).matchType };
      cur.s += 1 / (k + i + 1);
      score.set(h.messageId, cur);
      meta.set(h.messageId, meta.get(h.messageId) ?? (h as any).matchType);
    });
    return Array.from(score.values())
      .sort((x, y) => y.s - x.s)
      .map((x) => ({ ...x.hit, score: x.s, matchType: x.matchType }) as any);
  }
}
