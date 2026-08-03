import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database';
import { EmbeddingsService } from './embeddings.service';
import { ModelRegistry } from '../models/model-registry.service';
import { MODEL_CAPABILITY, MODEL_PROTOCOL } from '../models/model-provider.interface';
import type { IModelProvider } from '../models/model-provider.interface';

function makeProvider(overrides: Partial<IModelProvider> = {}): IModelProvider {
  return {
    id: 'MiniMax-M3',
    protocol: MODEL_PROTOCOL.ANTHROPIC,
    capabilities: [MODEL_CAPABILITY.EMBED],
    embedDim: 1024,
    embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    streamChat: jest.fn(),
    summarize: jest.fn(),
    ...overrides,
  };
}

describe('EmbeddingsService', () => {
  function setup(provider: IModelProvider, poolOverrides: Record<string, unknown> = {}) {
    const queryMock = jest.fn().mockResolvedValue({ rows: [] });
    const releaseMock = jest.fn();
    const connectMock = jest.fn().mockResolvedValue({
      query: queryMock,
      release: releaseMock,
    });
    const pool = {
      query: queryMock,
      connect: connectMock,
      ...poolOverrides,
    };
    const dbMock = {
      getPool: () => pool,
    } as unknown as DatabaseService;
    const cfg = { get: () => undefined } as unknown as ConfigService;
    const registry = new ModelRegistry([provider], cfg);
    const svc = new EmbeddingsService(registry, dbMock);
    return { svc, dbMock, pool, connectMock, queryMock, releaseMock };
  }

  it('upsert writes embedding + removes stale chunks', async () => {
    const p = makeProvider();
    const { svc, dbMock } = setup(p);
    const queries: string[] = [];
    (dbMock.getPool().query as jest.Mock).mockImplementation((q: string) => {
      queries.push(q);
      return { rows: [] };
    });

    await svc.upsert('excercise', 'ex1', '深蹲动作');
    expect((p.embed as jest.Mock).mock.calls[0][0]).toEqual({ input: '深蹲动作' });
    expect(queries.some((q) => q.includes('INSERT INTO "AiEmbedding"'))).toBe(true);
    expect(queries.some((q) => q.startsWith('DELETE FROM "AiEmbedding"'))).toBe(true);
  });

  it('upsert uses a transaction (BEGIN + COMMIT + release)', async () => {
    const p = makeProvider();
    const { svc, queryMock, releaseMock } = setup(p);
    await svc.upsert('excercise', 'ex1', 'tx-text');
    const statements = queryMock.mock.calls.map((c) => c[0]);
    expect(statements[0]).toBe('BEGIN');
    expect(statements).toContain('COMMIT');
    expect(releaseMock).toHaveBeenCalled();
    // On any error path we should also release
    queryMock.mockRejectedValueOnce(new Error('boom'));
    await expect(svc.upsert('excercise', 'ex2', 'tx-text-2')).rejects.toThrow(/boom/);
    expect(releaseMock).toHaveBeenCalled();
  });

  it('upsert reuses cached vector instead of calling provider', async () => {
    const p = makeProvider();
    const { svc } = setup(p);
    // Warm cache
    const v1 = await svc.embedOne('cached-text');
    // Upsert should hit cache, not provider
    await svc.upsert('excercise', 'ex1', 'cached-text');
    expect((p.embed as jest.Mock)).toHaveBeenCalledTimes(1);
    const v2 = await svc.embedOne('cached-text');
    expect(v2).toBe(v1);
  });

  it('remove deletes all chunks for owner', async () => {
    const { svc, dbMock } = setup(makeProvider());
    const queries: string[] = [];
    (dbMock.getPool().query as jest.Mock).mockImplementation((q: string) => {
      queries.push(q);
      return { rows: [] };
    });
    await svc.remove('excercise', 'ex1');
    expect(queries.some((q) => q.startsWith('DELETE FROM "AiEmbedding"') && q.includes('$1') && q.includes('$2'))).toBe(true);
  });

  it('throws when no provider supports embed', async () => {
    const p = makeProvider({ capabilities: [] });
    const { svc } = setup(p);
    await expect(svc.upsert('excercise', 'ex1', 'x')).rejects.toThrow(/EMBED/i);
  });

  it('cache returns same vector for repeated input without hitting provider again', async () => {
    const p = makeProvider();
    const { svc } = setup(p);
    const v1 = await svc.embedOne('foo');
    const v2 = await svc.embedOne('foo');
    expect(v1).toBe(v2);
    expect((p.embed as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('cache uses raw text as key (no hashing) to avoid collisions', async () => {
    const p = makeProvider();
    // Two distinct texts must remain independent
    const { svc } = setup(p);
    (p.embed as jest.Mock).mockImplementation(async ({ input }: { input: string }) => {
      return [[input.length, input.length * 2]];
    });
    const a = await svc.embedOne('alpha');
    const b = await svc.embedOne('beta');
    expect(a).toEqual([5, 10]);
    expect(b).toEqual([4, 8]);
    // Repeat alpha must still be alpha, not beta (collision would yield wrong vector)
    const aAgain = await svc.embedOne('alpha');
    expect(aAgain).toEqual([5, 10]);
  });

  it('cache evicts oldest entry when CACHE_MAX is reached', async () => {
    const p = makeProvider();
    const { svc } = setup(p);
    // CACHE_MAX is 1000; embed 1001 unique inputs so k0 is evicted (FIFO on insert)
    (p.embed as jest.Mock).mockImplementation(async ({ input }: { input: string }) => [[input.length]]);
    for (let i = 0; i < 1001; i++) {
      await svc.embedOne(`k${i}`);
    }
    expect((p.embed as jest.Mock)).toHaveBeenCalledTimes(1001);
    // k0 was evicted from the front → must hit provider again
    (p.embed as jest.Mock).mockClear();
    await svc.embedOne('k0');
    expect((p.embed as jest.Mock)).toHaveBeenCalledTimes(1);
    // k1000 was most recently inserted → still cached, no provider call
    (p.embed as jest.Mock).mockClear();
    await svc.embedOne('k1000');
    expect((p.embed as jest.Mock)).toHaveBeenCalledTimes(0);
  });

  it('cache respects TTL with fake timers', async () => {
    jest.useFakeTimers();
    try {
      const p = makeProvider();
      const { svc } = setup(p);
      const v1 = await svc.embedOne('ttl-text');
      expect((p.embed as jest.Mock)).toHaveBeenCalledTimes(1);
      // Advance past TTL (10 minutes + a tick)
      jest.advanceTimersByTime(10 * 60 * 1000 + 1000);
      const v2 = await svc.embedOne('ttl-text');
      // Two distinct mocked vectors would mean we re-embedded
      const calls = (p.embed as jest.Mock).mock.calls.length;
      expect(calls).toBe(2);
      expect(v2).toBeDefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('throws when provider returns no vector', async () => {
    const p = makeProvider({ embed: jest.fn().mockResolvedValue([]) });
    const { svc } = setup(p);
    await expect(svc.embedOne('empty')).rejects.toThrow(/empty vector/);
  });
});
