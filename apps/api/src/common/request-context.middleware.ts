import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContext, type LogContext, type Logger } from '@codepilot/logger';
import { LOGGER } from '../logging/logger.token';
import { resolveRequestId } from './request-id';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = resolveRequestId(request.header('x-request-id'));
    const started = Date.now();
    const path = (request.originalUrl.split('?')[0] ?? request.path).slice(0, 200);
    const context: LogContext = { requestId };

    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      this.logger.info(
        {
          requestId: context.requestId,
          ...(context.userId ? { userId: context.userId } : {}),
          method: request.method,
          path,
          statusCode: response.statusCode,
          durationMs: Date.now() - started,
        },
        'request completed',
      );
    });
    requestContext.run(context, () => {
      next();
    });
  }
}
