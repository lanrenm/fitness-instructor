import { loadModelProvidersFromEnv } from './model-config.loader';
import { MODEL_CAPABILITY } from '@fitness/shared-types/ai';

describe('ModelConfigLoader', () => {
  it('parses one anthropic provider from env', () => {
    const env = {
      MODELS_PROVIDER_MINIMAX_ID: 'MiniMax-M3',
      MODELS_PROVIDER_MINIMAX_PROTOCOL: 'anthropic',
      MODELS_PROVIDER_MINIMAX_API_KEY: 'sk-xxx',
      MODELS_PROVIDER_MINIMAX_BASE_URL: 'https://api.minimax.chat',
      MODELS_PROVIDER_MINIMAX_CHAT_MODEL: 'MiniMax-M3',
      MODELS_PROVIDER_MINIMAX_SUMMARY_MODEL: 'MiniMax-M3-haiku',
      MODELS_PROVIDER_MINIMAX_EMBED_MODEL: 'MiniMax-M3',
      MODELS_PROVIDER_MINIMAX_EMBED_DIM: '1024',
    };
    const out = loadModelProvidersFromEnv(env);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('MiniMax-M3');
    expect(out[0].protocol).toBe('anthropic');
    expect(out[0].embedDim).toBe(1024);
    // Anthropic adapter falls back to provider.id for chatModel, so we verify
    // capabilities include STREAM_CHAT+SUMMARIZE+EMBED (the configured embed model
    // enables the EMBED capability even though Anthropic SDK can't serve it).
    expect(out[0].capabilities).toEqual(
      expect.arrayContaining([
        MODEL_CAPABILITY.STREAM_CHAT,
        MODEL_CAPABILITY.SUMMARIZE,
        MODEL_CAPABILITY.EMBED,
      ]),
    );
  });

  it('returns [] when no providers configured', () => {
    expect(loadModelProvidersFromEnv({})).toEqual([]);
  });

  it('throws when MODELS_PROVIDER_*_ID is set without protocol', () => {
    expect(() =>
      loadModelProvidersFromEnv({
        MODELS_PROVIDER_X_ID: 'x',
        MODELS_PROVIDER_X_PROTOCOL: '',
      }),
    ).toThrow(/protocol/i);
  });

  it('throws on unknown protocol', () => {
    expect(() =>
      loadModelProvidersFromEnv({
        MODELS_PROVIDER_X_ID: 'x',
        MODELS_PROVIDER_X_PROTOCOL: 'gpt5',
      }),
    ).toThrow(/protocol/i);
  });
});