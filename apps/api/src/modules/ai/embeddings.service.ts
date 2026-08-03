import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { ModelRegistry } from '../models/model-registry.service';
import { MODEL_CAPABILITY } from '../models/model-provider.interface';
import { AI_RAG_OWNER_TYPE } from '@fitness/shared-types/ai';

interface IEmbedCacheEntry {
  v: number[];
  input: string;
  expires: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 1000;

@Injectable()
export class EmbeddingsService {
  private readonly cache = new Map<string, IEmbedCacheEntry>();

  constructor(
    private readonly registry: ModelRegistry,
    private readonly db: DatabaseService,
  ) {}

  async embedOne(text: string): Promise<number[]> {
    const cached = this.cache.get(text);
    if (cached && cached.expires > Date.now() && cached.input === text) {
      // LRU touch: re-insert to move to tail
      this.cache.delete(text);
      this.cache.set(text, cached);
      return cached.v;
    }
    const provider = this.resolveEmbedProvider();
    const [vec] = await provider.embed({ input: text });
    if (!vec) throw new Error('embed returned empty vector');
    this.setCache(text, vec);
    return vec;
  }

  async upsert(
    ownerType: (typeof AI_RAG_OWNER_TYPE)[keyof typeof AI_RAG_OWNER_TYPE],
    ownerId: string,
    chunkText: string,
  ): Promise<void> {
    const vec = await this.embedOne(chunkText);

    const client = await this.db.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO "AiEmbedding"(id, "ownerType", "ownerId", "providerId", "chunkText", embedding)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::vector)
         ON CONFLICT ("ownerType", "ownerId", "chunkText") DO UPDATE
           SET embedding = EXCLUDED.embedding,
               "providerId" = EXCLUDED."providerId";`,
        [ownerType, ownerId, this.resolveEmbedProvider().id, chunkText, this.toPgVector(vec)],
      );
      await client.query(
        `DELETE FROM "AiEmbedding" WHERE "ownerType"=$1 AND "ownerId"=$2 AND "chunkText" <> $3;`,
        [ownerType, ownerId, chunkText],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async remove(
    ownerType: (typeof AI_RAG_OWNER_TYPE)[keyof typeof AI_RAG_OWNER_TYPE],
    ownerId: string,
  ): Promise<void> {
    await this.db
      .getPool()
      .query(`DELETE FROM "AiEmbedding" WHERE "ownerType"=$1 AND "ownerId"=$2;`, [ownerType, ownerId]);
  }

  private resolveEmbedProvider() {
    const all = this.registry.list();
    const fallback = all.find((p) => p.capabilities.includes(MODEL_CAPABILITY.EMBED))?.id;
    return this.registry.resolveForCapability(MODEL_CAPABILITY.EMBED, {
      preferredId: process.env.AI_CHAT_EMBED_MODEL,
      fallback,
    });
  }

  private toPgVector(v: number[]): string {
    return '[' + v.join(',') + ']';
  }

  private setCache(text: string, v: number[]) {
    if (this.cache.size >= CACHE_MAX) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(text, { v, input: text, expires: Date.now() + CACHE_TTL_MS });
  }
}
