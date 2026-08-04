import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule DI graph', () => {
  it('resolves every provider', async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await mod.close();
  });
});
