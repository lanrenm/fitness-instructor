import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { DatabaseService } from './database';

// Guards against wiring regressions: a module that injects a service without
// providing (or importing) it fails here rather than at runtime on boot.
// DatabaseService is stubbed so this stays a pure DI check with no live
// Postgres required.
describe('AppModule DI graph', () => {
  it('resolves every provider', async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({
        query: jest.fn(),
        getPool: jest.fn(),
      })
      .compile();
    await mod.close();
  });
});
