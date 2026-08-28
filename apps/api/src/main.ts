// Must be the first import: @Throttle and anything else that reads
// process.env while its class is being defined runs before ConfigModule's
// providers exist, so a value living only in .env would be silently ignored.
// Loading it here makes local development behave like a deployment, where
// these arrive as real environment variables.
//
// dotenv is a runtime dependency for that reason, not a dev one. This import
// is unconditional, so a production install that omits the dev dependencies
// used to leave the built image unable to start at all — `Cannot find module
// 'dotenv/config'` on the very first line of the entry point. In a deployment
// the package finds no .env and does nothing, which is exactly right.
import 'dotenv/config';
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
