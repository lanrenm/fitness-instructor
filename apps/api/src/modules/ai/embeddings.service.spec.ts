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
  function setup(provider: IModelProvider) {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const dbMock = {
      getPool: () => pool,
    } as unknown as DatabaseService;
    const cfg = { get: () => undefined } as unknown as ConfigService;
    const registry = new ModelRegistry([provider], cfg);
    const svc = new EmbeddingsService(registry, dbMock);
    return { svc, dbMock };
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
});
