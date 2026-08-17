import { AnthropicProvider } from './anthropic.provider';

describe('AnthropicProvider', () => {
  const baseConfig = {
    id: 'MiniMax-M3',
    chatModel: 'MiniMax-M3',
    summaryModel: 'MiniMax-M3-haiku',
    embedModel: 'MiniMax-M3',
    embedDim: 1024,
  };

  it('reports capabilities and embedDim', () => {
    const p = new AnthropicProvider({ apiKey: 'k', config: baseConfig });
    expect(p.id).toBe('MiniMax-M3');
    expect(p.protocol).toBe('anthropic');
    expect(p.capabilities).toEqual(['streamChat', 'summarize', 'embed']);
    expect(p.embedDim).toBe(1024);
  });

  it('streamChat maps content_block_delta events to content events', async () => {
    const p = new AnthropicProvider({ apiKey: 'k', config: baseConfig });
    p.client.messages = {
      stream: () => {
        const events = [
          { type: 'content_block_start', content_block: { type: 'text', text: '' } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
          {
            type: 'message_delta',
            usage: { output_tokens: 12 },
            delta: { stop_reason: 'end_turn' },
          },
          { type: 'message_stop' },
        ];
        const asyncIter = (async function* () {
          for (const e of events) yield e as any;
        })();
        return asyncIter as any;
      },
    } as any;

    const events: any[] = [];
    for await (const e of p.streamChat({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      events.push(e);
    }

    expect(events).toEqual([
      { type: 'content', delta: 'hello' },
      { type: 'content', delta: ' world' },
      expect.objectContaining({ type: 'usage', completionTokens: 12 }),
      expect.objectContaining({ type: 'done', finishReason: 'end_turn' }),
    ]);
  });

  it('streamChat surfaces API errors as retryable error events', async () => {
    const p = new AnthropicProvider({ apiKey: 'k', config: baseConfig });
    p.client.messages = {
      stream: () => {
        const asyncIter = (async function* () {
          yield { type: 'error', error: { type: 'overloaded_error', message: 'overloaded' } } as any;
          yield { type: 'message_stop' } as any;
        })();
        return asyncIter as any;
      },
    } as any;

    const events: any[] = [];
    for await (const e of p.streamChat({ system: '', messages: [] })) events.push(e);
    const errEvent = events.find((x) => x.type === 'error');
    expect(errEvent).toBeDefined();
    expect(errEvent.error.retryable).toBe(true);
    expect(errEvent.error.code).toBe('overloaded_error');
  });

  it('summarize calls messages.create with single prompt', async () => {
    const p = new AnthropicProvider({ apiKey: 'k', config: baseConfig });
    p.client.messages = {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'summary-text' }],
        usage: { input_tokens: 5, output_tokens: 7 },
      }),
    } as any;

    const result = await p.summarize({ prompt: 'summarize this' });
    expect(result).toBe('summary-text');
  });

  it('embed returns empty when model has no embed support (Phase-1 stub)', async () => {
    const p = new AnthropicProvider({ apiKey: 'k', config: { ...baseConfig, embedModel: '' } });
    await expect(p.embed({ input: 'x' })).rejects.toThrow(/not supported/i);
  });
});
