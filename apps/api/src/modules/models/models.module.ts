import { Global, Module } from '@nestjs/common';
import { ModelRegistry, MODEL_PROVIDERS } from './model-registry.service';
import { loadModelProvidersFromEnv } from './model-config.loader';

@Global()
@Module({
  providers: [
    {
      provide: MODEL_PROVIDERS,
      useFactory: () => loadModelProvidersFromEnv(process.env),
    },
    ModelRegistry,
  ],
  exports: [ModelRegistry, MODEL_PROVIDERS],
})
export class ModelsModule {}