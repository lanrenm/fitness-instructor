import { RagService } from './rag.service';

describe('RagService.rrf', () => {
  it('merges two ranked lists via RRF', () => {
    const svc = new RagService({} as any, {} as any, {} as any);
    const merged = (svc as any).rrf(
      [
        { ownerType: 'training_session', ownerId: 'a', chunkText: 'a', score: 0.9 },
        { ownerType: 'training_session', ownerId: 'b', chunkText: 'b', score: 0.7 },
      ],
      [
        { ownerType: 'training_session', ownerId: 'b', chunkText: 'b', score: 0.9 },
        { ownerType: 'training_session', ownerId: 'c', chunkText: 'c', score: 0.6 },
      ],
      60,
    );
    expect(merged[0].ownerId).toBe('b');
    expect(merged.length).toBe(3);
  });
});

describe('RagService.filterByOwner', () => {
  it('removes hits not owned by userId', async () => {
    const dbMock = {
      getPool: () => ({
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes('"TrainingSession"')) {
            return { rows: [{ id: 'a' }] };
          }
          return { rows: [] };
        }),
      }),
    };
    const svc = new RagService({} as any, {} as any, dbMock as any);
    const hits = [
      { ownerType: 'training_session', ownerId: 'a', chunkText: 'a', score: 0.9 },
      { ownerType: 'training_session', ownerId: 'b', chunkText: 'b', score: 0.8 },
    ];
    const out = await (svc as any).filterByOwner('u1', hits);
    expect(out).toEqual([{ ownerType: 'training_session', ownerId: 'a', chunkText: 'a', score: 0.9 }]);
  });
});
