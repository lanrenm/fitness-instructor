import { ConfigService } from '@nestjs/config';
import { ModelRegistry } from './model-registry.service';
import type { IModelProvider } from './model-provider.interface';
import { MODEL_CAPABILITY } from '@fitness/shared-types/ai';

function makeProvider(overrides: Partial<IModelProvider> = {}): IModelProvider {
  return {
    id: 'MiniMax-M3',
    protocol: 'anthropic',
    capabilities: [
      MODEL_CAPABILITY.STREAM_CHAT,
      MODEL_CAPABILITY.SUMMARIZE,
      MODEL_CAPABILITY.EMBED,
    ],
    embedDim: 1024,
    streamChat: jest.fn(),
    summarize: jest.fn(),
    embed: jest.fn(),
    ...overrides,
  } as IModelProvider;
}

describe('ModelRegistry', () => {
  function setup(providers: IModelProvider[], cfgMap: Record<string, string> = {}) {
    const cfg = { get: (k: string) => cfgMap[k] } as unknown as ConfigService;
    // Nest DI: @Inject(MODEL_PROVIDERS) providerList is the resolved provider
    // list; cfg is ConfigService. Bypass the @Inject decorator by passing
    // the resolved values directly to the constructor.
    return new ModelRegistry(providers, cfg);
  }

  it('returns registered provider by id', () => {
    const p = makeProvider({ id: 'MiniMax-M3' });
    const r = setup([p]);
    expect(r.resolve('MiniMax-M3')).toBe(p);
  });

  it('throws on unknown provider id', () => {
    const r = setup([makeProvider()]);
    expect(() => r.resolve('nope')).toThrow(/unknown model provider/i);
  });

  it('resolveForCapability picks preferred, falls back on miss', () => {
    const p1 = makeProvider({ id: 'MiniMax-M3' });
    const p2 = makeProvider({ id: 'fallback', capabilities: [MODEL_CAPABILITY.STREAM_CHAT] });
    const r = setup([p1, p2]);
    expect(
      r.resolveForCapability(MODEL_CAPABILITY.STREAM_CHAT, {
        preferredId: 'MiniMax-M3',
        fallback: 'fallback',
      }),
    ).toBe(p1);
    expect(
      r.resolveForCapability(MODEL_CAPABILITY.STREAM_CHAT, {
        preferredId: 'missing',
        fallback: 'fallback',
      }),
    ).toBe(p2);
  });

  it('falls back when preferred is registered but lacks capability', () => {
    const p1 = makeProvider({ id: 'preferred', capabilities: [MODEL_CAPABILITY.STREAM_CHAT] });
    const p2 = makeProvider({ id: 'fallback', capabilities: [MODEL_CAPABILITY.EMBED] });
    const r = setup([p1, p2]);
    expect(
      r.resolveForCapability(MODEL_CAPABILITY.EMBED, {
        preferredId: 'preferred',
        fallback: 'fallback',
      }),
    ).toBe(p2);
  });

  it('throws when capability not supported by resolved provider', () => {
    const p = makeProvider({ id: 'MiniMax-M3', capabilities: [MODEL_CAPABILITY.STREAM_CHAT] });
    const r = setup([p]);
    expect(() =>
      r.resolveForCapability(MODEL_CAPABILITY.EMBED, { preferredId: 'MiniMax-M3' }),
    ).toThrow(/does not support/i);
  });
});
