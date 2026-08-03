import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database';
import { EmbeddingsService } from './embeddings.service';
import { AI_RAG_OWNER_TYPE, IAiCitation } from '@fitness/shared-types/ai';

interface IRawHit {
  ownerType: string;
  ownerId: string;
  chunkText: string;
  score: number;
}

const RAG_TIMEOUT_MS = Number(process.env.AI_CHAT_RAG_TIMEOUT_MS ?? 600);

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly cfg: ConfigService,
    private readonly db: DatabaseService,
  ) {}

  async retrieve(userId: string, query: string): Promise<IAiCitation[]> {
    const started = Date.now();
    const ownerTypes = [
      AI_RAG_OWNER_TYPE.TRAINING_SESSION,
      AI_RAG_OWNER_TYPE.WORKOUT,
      AI_RAG_OWNER_TYPE.EXCERCISE,
      AI_RAG_OWNER_TYPE.MUSCLE_GROUP,
    ];

    let vectorHits: IRawHit[] = [];
    let keywordHits: IRawHit[] = [];

    try {
      const [vec, kw] = await Promise.all([
        this.vectorRecall(query, ownerTypes),
        this.keywordRecall(query, ownerTypes),
      ]);
      vectorHits = vec;
      keywordHits = kw;
    } catch (e: any) {
      this.logger.warn(`rag retrieval failed: ${e?.message}`);
      return [];
    }

    if (Date.now() - started > RAG_TIMEOUT_MS) {
      this.logger.warn(`rag retrieval exceeded ${RAG_TIMEOUT_MS}ms — returning empty`);
      return [];
    }

    const merged = this.rrf(vectorHits, keywordHits, 60).slice(0, 5);
    const owned = await this.filterByOwner(userId, merged);
    return owned.map((h) => ({
      type: h.ownerType as any,
      id: h.ownerId,
      score: h.score,
      snippet: h.chunkText.slice(0, 200),
    }));
  }

  private async vectorRecall(query: string, ownerTypes: string[]): Promise<IRawHit[]> {
    const vec = await this.embeddings.embedOne(query);
    const pgVec = '[' + vec.join(',') + ']';
    const { rows } = await this.db.getPool().query(
      `SELECT "ownerType", "ownerId", "chunkText",
              1 - (embedding <=> $1::vector) AS score
       FROM "AiEmbedding"
       WHERE "ownerType" = ANY($2::text[])
       ORDER BY embedding <=> $1::vector
       LIMIT 12`,
      [pgVec, ownerTypes],
    );
    return rows;
  }

  private async keywordRecall(query: string, ownerTypes: string[]): Promise<IRawHit[]> {
    try {
      const { rows } = await this.db.getPool().query(
        `SELECT "ownerType", "ownerId", "chunkText",
                ts_rank(to_tsvector('simple', "chunkText"), plainto_tsquery('simple', $1)) AS score
         FROM "AiEmbedding"
         WHERE to_tsvector('simple', "chunkText") @@ plainto_tsquery('simple', $1)
           AND "ownerType" = ANY($2::text[])
         ORDER BY score DESC LIMIT 12`,
        [query, ownerTypes],
      );
      return rows;
    } catch {
      const { rows } = await this.db.getPool().query(
        `SELECT "ownerType", "ownerId", "chunkText", 0.5 AS score
         FROM "AiEmbedding"
         WHERE "chunkText" ILIKE '%' || $1 || '%'
           AND "ownerType" = ANY($2::text[])
         LIMIT 12`,
        [query, ownerTypes],
      );
      return rows;
    }
  }

  private async filterByOwner(userId: string, hits: IRawHit[]): Promise<IRawHit[]> {
    if (hits.length === 0) return [];
    const out: IRawHit[] = [];

    const tsIds = hits.filter((h) => h.ownerType === AI_RAG_OWNER_TYPE.TRAINING_SESSION).map((h) => h.ownerId);
    const wkIds = hits.filter((h) => h.ownerType === AI_RAG_OWNER_TYPE.WORKOUT).map((h) => h.ownerId);
    const exIds = hits.filter((h) => h.ownerType === AI_RAG_OWNER_TYPE.EXCERCISE).map((h) => h.ownerId);

    const ownedTs = new Set<string>();
    const ownedWk = new Set<string>();
    const ownedEx = new Set<string>();

    if (tsIds.length) {
      const { rows } = await this.db.getPool().query(
        `SELECT id FROM "TrainingSession" WHERE id = ANY($1::text[]) AND "userId" = $2`,
        [tsIds, userId],
      );
      rows.forEach((r: any) => ownedTs.add(r.id));
    }
    if (wkIds.length) {
      const { rows } = await this.db.getPool().query(
        `SELECT id FROM "Workout" WHERE id = ANY($1::text[]) AND "userId" = $2`,
        [wkIds, userId],
      );
      rows.forEach((r: any) => ownedWk.add(r.id));
    }
    if (exIds.length) {
      const { rows } = await this.db.getPool().query(
        `SELECT DISTINCT e.id AS id
         FROM "Excercises" e
         JOIN "WorkoutExcercises" we ON we."excerciseId" = e.id
         JOIN "Workout" w ON w.id = we."workoutId"
         WHERE e.id = ANY($1::text[]) AND w."userId" = $2`,
        [exIds, userId],
      );
      rows.forEach((r: any) => ownedEx.add(r.id));
    }

    for (const h of hits) {
      if (h.ownerType === AI_RAG_OWNER_TYPE.TRAINING_SESSION && ownedTs.has(h.ownerId)) out.push(h);
      else if (h.ownerType === AI_RAG_OWNER_TYPE.WORKOUT && ownedWk.has(h.ownerId)) out.push(h);
      else if (h.ownerType === AI_RAG_OWNER_TYPE.EXCERCISE && ownedEx.has(h.ownerId)) out.push(h);
      else if (h.ownerType === AI_RAG_OWNER_TYPE.MUSCLE_GROUP) {
        out.push(h);
      }
    }
    return out;
  }

  private rrf(vecList: IRawHit[], kwList: IRawHit[], k: number): IRawHit[] {
    const score = new Map<string, { hit: IRawHit; s: number }>();
    const keyOf = (h: IRawHit) => `${h.ownerType}:${h.ownerId}`;
    vecList.forEach((h, i) => {
      const kk = keyOf(h);
      const cur = score.get(kk) ?? { hit: h, s: 0 };
      cur.s += 1 / (k + i + 1);
      score.set(kk, cur);
    });
    kwList.forEach((h, i) => {
      const kk = keyOf(h);
      const cur = score.get(kk) ?? { hit: h, s: 0 };
      cur.s += 1 / (k + i + 1);
      score.set(kk, cur);
    });
    return Array.from(score.values())
      .sort((a, b) => b.s - a.s)
      .map((x) => ({ ...x.hit, score: x.s }));
  }
}
