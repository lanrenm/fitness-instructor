import { WorkoutsService } from './workouts.service';

describe('WorkoutsService.create', () => {
  it('inserts workout + writes embedding', async () => {
    const clientQuery = jest.fn().mockResolvedValue({ rows: [{ id: 'w1' }] });
    const client = {
      query: clientQuery,
      release: jest.fn(),
    };
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 'w1' }] }),
      connect: jest.fn().mockResolvedValue(client),
    };
    const dbMock = { getPool: () => pool } as any;
    const embMock = { upsert: jest.fn().mockResolvedValue(undefined) } as any;
    const svc = new WorkoutsService(dbMock, embMock);
    await svc.create('u1', {
      name: '周一胸肌',
      description: '大重量',
      workoutExcerciseIds: ['e1'],
    });
    expect(clientQuery).toHaveBeenCalled();
    expect(embMock.upsert).toHaveBeenCalledWith('workout', 'w1', expect.stringContaining('周一胸肌'));
  });
});