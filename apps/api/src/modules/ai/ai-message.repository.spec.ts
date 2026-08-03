import { DatabaseService } from '../../database';
import { AiMessageRepository } from './ai-message.repository';

describe('AiMessageRepository', () => {
  function setup() {
    const pool = { query: jest.fn() };
    const dbMock = { getPool: () => pool } as unknown as DatabaseService;
    return { repo: new AiMessageRepository(dbMock), pool };
  }

  it('appendMessage inserts one row and returns it', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
    const row = await repo.appendMessage('c1', {
      role: 'user',
      content: 'hi',
      reasoning: null,
      ragContext: [],
      providerId: 'MiniMax-M3',
      promptTokens: 0,
      completionTokens: 0,
    });
    expect(row.id).toBe('m1');
    expect(pool.query.mock.calls[0][0]).toMatch(/INSERT INTO "AiMessage"/);
  });

  it('getRecentForConversation excludes compressed messages', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [] });
    await repo.getRecentForConversation('c1', 6);
    const sql = pool.query.mock.calls[0][0];
    expect(sql).toMatch(/"compressed" = false/);
    expect(sql).toMatch(/ORDER BY "createdAt" DESC/);
  });

  it('getForConversation returns all messages', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [] });
    await repo.getForConversation('c1');
    expect(pool.query.mock.calls[0][0]).toMatch(/SELECT \* FROM "AiMessage"/);
  });

  it('getForConversation uses the cursor message createdAt for sinceId', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [] });
    await repo.getForConversation('c1', 'm1');
    const [sql, args] = pool.query.mock.calls[0];
    expect(sql).toMatch(
      /"createdAt" > \(SELECT "createdAt" FROM "AiMessage" WHERE id = \$2\)/,
    );
    expect(args).toEqual(['c1', 'm1']);
  });

  it('markCompressed bulk-updates compressed=true', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rowCount: 3 });
    const n = await repo.markCompressed(['m1', 'm2', 'm3']);
    expect(n).toBe(3);
    const sql = pool.query.mock.calls[0][0];
    // Relaxed to match the quoted column name form used in SQL
    expect(sql).toMatch(/UPDATE "AiMessage"/);
    expect(sql).toMatch(/"?compressed"?\s*=\s*true/);
  });

  it('countForConversation returns number', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [{ c: 5 }] });
    expect(await repo.countForConversation('c1')).toBe(5);
  });

  it('listUncompressed returns compressed=false messages', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [] });
    await repo.listUncompressed('c1');
    expect(pool.query.mock.calls[0][0]).toMatch(/"compressed" = false/);
  });
});