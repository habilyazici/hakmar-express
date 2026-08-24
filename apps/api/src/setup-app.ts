import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { Application } from 'express';
import helmet from 'helmet';

/**
 * Shared between main.ts and the e2e test bootstrap so tests exercise the
 * exact same prefix/pipes/security headers as the real app, not a
 * hand-approximated subset of it.
 */
export function setupApp(app: INestApplication): INestApplication {
  // Off by default (Express's own default) so a client can't spoof
  // X-Forwarded-For to dodge the per-IP login throttle when there's no
  // actual proxy in front. Set TRUST_PROXY to the number of proxy hops
  // (e.g. "1" for a single nginx/ALB in front) once this is actually
  // deployed behind one — without it, every request behind any proxy
  // arrives from that proxy's one IP, collapsing ThrottlerGuard's per-IP
  // login limit into a single shared bucket for all users.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const parsed = Number(trustProxy);
    const expressInstance = app.getHttpAdapter().getInstance() as Application;
    expressInstance.set(
      'trust proxy',
      Number.isNaN(parsed) ? trustProxy : parsed,
    );
  }

  app.use(helmet());
  app.use(cookieParser());
  // credentials:true plus an explicit single origin — never a wildcard, which
  // browsers reject alongside credentials anyway — is what lets the refresh
  // cookie travel on the XHR from the web app.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return app;
}
