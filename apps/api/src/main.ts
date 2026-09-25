import 'reflect-metadata';
import './load-env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseFoundationEnv } from '@codepilot/config';
import { errorMessage } from '@codepilot/logger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LOGGER } from './logging/logger.token';
import type { Logger } from '@codepilot/logger';

async function bootstrap(): Promise<void> {
  const env = parseFoundationEnv(process.env);
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const logger = app.get<Logger>(LOGGER);
  const origins = Array.from(
    new Set([env.WEB_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000']),
  );

  const httpsWeb = env.WEB_ORIGIN.startsWith('https://');
  app.use(
    helmet({
      strictTransportSecurity: httpsWeb ? undefined : false,
      contentSecurityPolicy: httpsWeb
        ? undefined
        : {
            useDefaults: true,
            directives: {
              upgradeInsecureRequests: null,
            },
          },
    }),
  );
  app.enableCors({
    origin: env.NODE_ENV === 'production' ? [env.WEB_ORIGIN] : origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  await app.listen(env.API_PORT, '0.0.0.0');
  logger.info({ port: env.API_PORT }, 'api listening');
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exit(1);
});
