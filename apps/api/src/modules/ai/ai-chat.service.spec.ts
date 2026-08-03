import { AiChatService } from './ai-chat.service';

describe('AiChatService.stream', () => {
  function setup(
    opts: { ragHits?: any[]; events?: any[] } = {},
  ) {
    const rag = {
      retrieve: jest.fn().mockResolvedValue(opts.ragHits ?? []),
    };
    const emb = {
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const messageRepo = {
      appendMessage: jest.fn().mockResolvedValue({ id: 'm_new', conversationId: 'c1' }),
      getRecentForConversation: jest.fn().mockResolvedValue([
        { id: 'a', role: 'assistant', content: 'hi', createdAt: '2026-07-29T00:00:00Z' },
        { id: 'u', role: 'user', content: 'old', createdAt: '2026-07-29T00:00:01Z' },
      ]),
      countForConversation: jest.fn().mockResolvedValue(2),
    };
    const convRepo = {
      assertOwned: jest
        .fn()
        .mockResolvedValue({ id: 'c1', userId: 'u1', model: 'MiniMax-M3', temperature: 0.7 }),
    };
    const provider = {
      id: 'MiniMax-M3',
      capabilities: ['streamChat'],
      streamChat: jest.fn().mockImplementation(async function* () {
        for (const e of opts.events ?? [
          { type: 'content', delta: 'hello' },
          { type: 'usage', promptTokens: 10, completionTokens: 5 },
          { type: 'done', finishReason: 'stop' },
        ]) {
          yield e;
        }
      }),
    };
    const registry = {
      resolveForCapability: jest.fn().mockReturnValue(provider),
    };
    const compression = { run: jest.fn() };
    const cfg = {
      get: (k: string) =>
        ({ AI_CHAT_WINDOW_SIZE: '6', AI_CHAT_COMPRESS_COOLDOWN_MS: '300000' } as any)[k],
    } as any;

    const svc = new AiChatService(
      rag as any,
      emb as any,
      messageRepo as any,
      convRepo as any,
      registry as any,
      compression as any,
      cfg as any,
    );
    return { svc, rag, emb, messageRepo, provider, compression };
  }

  it('emits meta + content + citations + usage + done', async () => {
    const { svc } = setup({
      ragHits: [{ type: 'training_session', id: 't1', score: 0.9, snippet: 's' }],
    });
    const obs$ = svc.stream('u1', 'c1', { content: 'hi' });
    const events: any[] = [];
    await new Promise<void>((resolve, reject) => {
      obs$.subscribe({
        next: (e) => events.push(e),
        error: reject,
        complete: resolve,
      });
    });
    const types = events.map((e) => e.type);
    expect(types).toContain('meta');
    expect(types).toContain('content');
    expect(types).toContain('citations');
    expect(types).toContain('usage');
    expect(types).toContain('done');
  });

  it('appends both user + assistant messages + embeddings', async () => {
    const { svc, messageRepo, emb } = setup();
    const obs$ = svc.stream('u1', 'c1', { content: 'hi' });
    await new Promise<void>((resolve) => obs$.subscribe({ complete: resolve }));
    expect(messageRepo.appendMessage).toHaveBeenCalledTimes(2);
    expect(emb.upsert).toHaveBeenCalledTimes(2);
  });
});