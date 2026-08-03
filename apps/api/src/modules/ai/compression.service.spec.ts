import { CompressionService } from './compression.service';

describe('CompressionService.run', () => {
  it('updates summary + marks compressed, swallows provider errors', async () => {
    const messageRepo = {
      listUncompressed: jest.fn().mockResolvedValue([
        { id: 'm1', role: 'user', content: 'A' },
        { id: 'm2', role: 'assistant', content: 'B' },
      ]),
      markCompressed: jest.fn().mockResolvedValue(2),
    };
    const convRepo = { update: jest.fn().mockResolvedValue({}) };
    const summaryProvider = {
      id: 'haiku',
      summarize: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const registry = {
      resolveForCapability: jest.fn().mockReturnValue(summaryProvider),
    };
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const svc = new CompressionService(registry as any, messageRepo as any, convRepo as any);
    await svc.run('c1');

    expect(summaryProvider.summarize).toHaveBeenCalled();
    expect(messageRepo.markCompressed).not.toHaveBeenCalled();
    expect(convRepo.update).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('happy path: summarizes, writes back, marks compressed', async () => {
    const messageRepo = {
      listUncompressed: jest.fn().mockResolvedValue([
        { id: 'm1', role: 'user', content: 'A' },
        { id: 'm2', role: 'assistant', content: 'B' },
      ]),
      markCompressed: jest.fn().mockResolvedValue(2),
    };
    const convRepo = { update: jest.fn().mockResolvedValue({}) };
    const summaryProvider = {
      id: 'haiku',
      summarize: jest.fn().mockResolvedValue('summary text'),
    };
    const registry = { resolveForCapability: jest.fn().mockReturnValue(summaryProvider) };
    const svc = new CompressionService(registry as any, messageRepo as any, convRepo as any);
    await svc.run('c1');
    expect(convRepo.update).toHaveBeenCalledWith('c1', expect.objectContaining({ summary: 'summary text' }));
    expect(messageRepo.markCompressed).toHaveBeenCalledWith(['m1', 'm2']);
  });
});