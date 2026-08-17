import { SearchService } from './search.service';
import { EmbeddingsService } from './embeddings.service';

describe('SearchService.rrf', () => {
  it('merges keyword + semantic ranked lists', () => {
    const svc = new SearchService({} as any, {} as any);
    const merged = (svc as any).rrf(
      [{ messageId: 'm1', score: 1 }],
      [{ messageId: 'm2', score: 1 }, { messageId: 'm1', score: 0.5 }],
      60,
    );
    const ids = merged.map((m: any) => m.messageId);
    expect(ids[0]).toBe('m1');
  });
});

describe('SearchService.query', () => {
  it('passes through RAG-derived hits and tags matchType', async () => {
    const dbMock = {
      getPool: () => ({
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes('plainto_tsquery')) {
            return { rows: [{ messageId: 'm1', conversationId: 'c1', snippet: 'foo bar', score: 0.9 }] };
          }
          if (sql.includes('embedding')) {
            return { rows: [{ messageId: 'm2', conversationId: 'c1', snippet: 'baz', score: 0.85 }] };
          }
          return { rows: [] };
        }),
      }),
    };
    const embMock = { embedOne: jest.fn().mockResolvedValue([0.1, 0.2]) } as any;
    const svc = new SearchService(embMock, dbMock as any);
    const out = await svc.search('u1', 'foo');
    expect(out.length).toBeGreaterThan(0);
    expect(['keyword', 'semantic']).toContain(out[0].matchType);
  });
});
