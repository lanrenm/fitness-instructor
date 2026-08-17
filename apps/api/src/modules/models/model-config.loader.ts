import { IModelProvider } from './model-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAICompatibleProvider } from './providers/openai-compatible.provider';

interface IParsedProvider {
  id: string;
  protocol: 'anthropic' | 'openai-compatible';
  // API_KEY non-emptiness is enforced in loadModelProvidersFromEnv before
  // reaching `instantiate`, so by the time we hand this off to a provider
  // constructor apiKey is guaranteed to be a non-empty string.
  apiKey: string;
  baseUrl?: string;
  config: {
    chatModel: string;
    summaryModel: string;
    embedModel: string;
    embedDim: number;
  };
}

/**
 * 从环境变量读取所有 MODELS_PROVIDER_*_* 块,构造 provider 实例。
 *
 * 期望的 env 形态(每个 provider 块):
 *   MODELS_PROVIDER_<UPPER_KEY>_ID                  (必填,作为 provider id)
 *   MODELS_PROVIDER_<UPPER_KEY>_PROTOCOL            (必填,'anthropic' | 'openai-compatible')
 *   MODELS_PROVIDER_<UPPER_KEY>_API_KEY             (必填)
 *   MODELS_PROVIDER_<UPPER_KEY>_BASE_URL            (可选)
 *   MODELS_PROVIDER_<UPPER_KEY>_CHAT_MODEL          (必填,本期 Anthropic adapter 用 provider.id 覆盖)
 *   MODELS_PROVIDER_<UPPER_KEY>_SUMMARY_MODEL       (必填)
 *   MODELS_PROVIDER_<UPPER_KEY>_EMBED_MODEL         (可选,空 = 不支持 embed)
 *   MODELS_PROVIDER_<UPPER_KEY>_EMBED_DIM           (embed_model 非空时必填)
 */
export function loadModelProvidersFromEnv(env: NodeJS.ProcessEnv): IModelProvider[] {
  const groups = new Map<string, Record<string, string>>();

  for (const [key, raw] of Object.entries(env)) {
    const m = /^MODELS_PROVIDER_([A-Z0-9]+)_(.+)$/.exec(key);
    if (!m) continue;
    const [, upperKey, prop] = m;
    const slot = groups.get(upperKey) ?? {};
    if (raw != null) slot[prop] = String(raw);
    groups.set(upperKey, slot);
  }

  const out: IModelProvider[] = [];
  for (const [, props] of groups) {
    const id = props.ID;
    const protocol = props.PROTOCOL;
    if (!id) continue;
    if (!protocol || (protocol !== 'anthropic' && protocol !== 'openai-compatible')) {
      throw new Error(
        `MODELS_PROVIDER_${id}: invalid or missing PROTOCOL (got '${protocol}', must be 'anthropic' | 'openai-compatible')`,
      );
    }
    // Fail fast on missing credentials — without this, the provider is built
    // successfully and only blows up at first request time inside the SDK
    // (Anthropic SDK v0.115 throws "Could not resolve authentication method"
    // when apiKey is empty/missing). Checking at startup surfaces the
    // misconfiguration immediately and gives the operator a clear message.
    if (!props.API_KEY) {
      throw new Error(
        `MODELS_PROVIDER_${id}: missing API_KEY (set MODELS_PROVIDER_${id}_API_KEY in the env)`,
      );
    }
    const parsed: IParsedProvider = {
      id,
      protocol: protocol as any,
      // Non-null assertion is safe: the missing/empty API_KEY check above
      // throws before this point, so props.API_KEY is guaranteed truthy
      // here. We use `|| undefined` in the constructor signature so empty
      // strings collapse cleanly rather than propagating as `''`.
      apiKey: props.API_KEY!,
      baseUrl: props.BASE_URL,
      config: {
        chatModel: props.CHAT_MODEL ?? id,
        summaryModel: props.SUMMARY_MODEL ?? id,
        embedModel: props.EMBED_MODEL ?? '',
        embedDim: props.EMBED_DIM ? Number(props.EMBED_DIM) : 0,
      },
    };
    if (parsed.config.embedModel && !parsed.config.embedDim) {
      throw new Error(`MODELS_PROVIDER_${id}: EMBED_DIM is required when EMBED_MODEL is set`);
    }
    out.push(instantiate(parsed));
  }

  return out;
}

function instantiate(p: IParsedProvider): IModelProvider {
  if (p.protocol === 'anthropic') {
    return new AnthropicProvider({
      apiKey: p.apiKey,
      baseUrl: p.baseUrl,
      config: {
        id: p.id,
        chatModel: p.config.chatModel,
        summaryModel: p.config.summaryModel,
        embedModel: p.config.embedModel,
        embedDim: p.config.embedDim,
      },
    });
  }
  return new OpenAICompatibleProvider({
    id: p.id,
    baseUrl: p.baseUrl ?? '',
    apiKey: p.apiKey,
    chatModel: p.config.chatModel,
    summaryModel: p.config.summaryModel,
    embedModel: p.config.embedModel,
    embedDim: p.config.embedDim,
  });
}