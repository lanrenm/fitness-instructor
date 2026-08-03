import { IModelProvider } from './model-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAICompatibleProvider } from './providers/openai-compatible.provider';

interface IParsedProvider {
  id: string;
  protocol: 'anthropic' | 'openai-compatible';
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
    const parsed: IParsedProvider = {
      id,
      protocol: protocol as any,
      apiKey: props.API_KEY ?? '',
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