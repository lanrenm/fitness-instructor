import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IModelProvider,
  TModelCapability,
} from './model-provider.interface';

export const MODEL_PROVIDERS = Symbol.for('MODEL_PROVIDERS');

export interface IResolveCapabilityOpts {
  preferredId?: string;
  fallback?: string;
}

@Injectable()
export class ModelRegistry {
  private readonly byId = new Map<string, IModelProvider>();

  constructor(
    @Inject(MODEL_PROVIDERS) private readonly providerList: IModelProvider[],
    private readonly cfg: ConfigService,
  ) {
    for (const p of providerList) {
      if (this.byId.has(p.id)) {
        throw new Error(`Duplicate model provider id: ${p.id}`);
      }
      this.byId.set(p.id, p);
    }
  }

  resolve(providerId: string): IModelProvider {
    const p = this.byId.get(providerId);
    if (!p) {
      const known = Array.from(this.byId.keys()).join(', ') || '(none)';
      throw new BadRequestException(
        `unknown model provider: ${providerId}; known providers: ${known}`,
      );
    }
    return p;
  }

  resolveForCapability(
    cap: TModelCapability,
    opts: IResolveCapabilityOpts = {},
  ): IModelProvider {
    const candidates: string[] = [];
    if (opts.preferredId) candidates.push(opts.preferredId);
    if (opts.fallback) candidates.push(opts.fallback);

    for (const id of candidates) {
      const p = this.byId.get(id);
      if (!p) continue; // unknown id: skip to next candidate
      if (p.capabilities.includes(cap)) return p;
      throw new BadRequestException(
        `Provider '${id}' does not support capability '${cap}'`,
      );
    }

    throw new BadRequestException(
      `No registered provider supports capability '${cap}' (tried: ${candidates.join(', ') || 'none configured'})`,
    );
  }

  list(): IModelProvider[] {
    return Array.from(this.byId.values());
  }
}
