import { DatabaseService } from '../../database';
import { AiConversationRepository } from './ai-conversation.repository';

describe('AiConversationRepository', () => {
  function setup() {
    const pool = { query: jest.fn() };
    const dbMock = { getPool: () => pool } as unknown as DatabaseService;
    const repo = new AiConversationRepository(dbMock);
    return { repo, pool };
  }

  it('create returns new row', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', userId: 'u1' }] });
    const out = await repo.create('u1', { model: 'MiniMax-M3', temperature: 0.5 });
    expect(out.id).toBe('c1');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('assertOwned throws Forbidden when row absent', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [] });
    await expect(repo.assertOwned('c1', 'u1')).rejects.toThrow(/not found|forbidden/i);
  });

  it('findById returns null when not found', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await repo.findById('nope')).toBeNull();
  });

  it('listForUser paginates by cursor (updatedAt desc)', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }, { id: 'c2' }] });
    const out = await repo.listForUser('u1', { limit: 20, cursor: null });
    expect(out.map((x) => x.id)).toEqual(['c1', 'c2']);
    expect(pool.query.mock.calls[0][0]).toMatch(/ORDER BY "updatedAt" DESC/);
  });

  it('update applies partial fields', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await repo.update('c1', { title: 'new' });
    expect(pool.query.mock.calls[0][0]).toMatch(/UPDATE "AiConversation"/);
  });

  it('delete returns true on success', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await repo.delete('c1')).toBe(true);
  });
});
