import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  // Without this, SIGTERM (how every container runtime asks a process to
  // stop) kills the app without ever running onModuleDestroy, so Prisma
  // never closes its pool and in-flight queries are cut mid-flight.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err: unknown) => {
  console.error('Failed to start application', err);
  process.exit(1);
});
