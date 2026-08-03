import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { ModelRegistry } from '../models/model-registry.service';
import { MODEL_CAPABILITY } from '../models/model-provider.interface';
import { AI_RAG_OWNER_TYPE } from '@fitness/shared-types/ai';

interface IEmbedCacheEntry {
  v: number[];
  expires: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 1000;

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly cache = new Map<string, IEmbedCacheEntry>();

  constructor(
    private readonly registry: ModelRegistry,
    private readonly db: DatabaseService,
  ) {}

  async embedOne(text: string): Promise<number[]> {
    const key = this.cacheKey(text);
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.v;
    }
    const provider = this.resolveEmbedProvider();
    const [vec] = await provider.embed({ input: text });
    if (!vec) throw new Error('embed returned empty vector');
    this.setCache(key, vec);
    return vec;
  }

  async upsert(
    ownerType: (typeof AI_RAG_OWNER_TYPE)[keyof typeof AI_RAG_OWNER_TYPE],
    ownerId: string,
    chunkText: string,
  ): Promise<void> {
    const provider = this.resolveEmbedProvider();
    const [vec] = await provider.embed({ input: chunkText });
    if (!vec) throw new Error('embed returned empty vector');

    await this.db.getPool().query(
      `INSERT INTO "AiEmbedding"(id, "ownerType", "ownerId", "providerId", "chunkText", embedding)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::vector)
       ON CONFLICT ("ownerType", "ownerId", "chunkText") DO UPDATE
         SET embedding = EXCLUDED.embedding,
             "providerId" = EXCLUDED."providerId";`,
      [ownerType, ownerId, provider.id, chunkText, this.toPgVector(vec)],
    );
    await this.db
      .getPool()
      .query(
        `DELETE FROM "AiEmbedding" WHERE "ownerType"=$1 AND "ownerId"=$2 AND "chunkText" <> $3;`,
        [ownerType, ownerId, chunkText],
      );
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

  private cacheKey(text: string): string {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return String(h);
  }

  private setCache(k: string, v: number[]) {
    if (this.cache.size >= CACHE_MAX) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(k, { v, expires: Date.now() + CACHE_TTL_MS });
  }
}
