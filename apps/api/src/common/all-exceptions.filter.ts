import { Catch, HttpException, HttpStatus, Inject, type ExceptionFilter } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
import { errorMessage, type Logger } from '@codepilot/logger';
import type { ApiErrorBody } from '@codepilot/types';
import { LOGGER } from '../logging/logger.token';
import { clientError } from './client-error';
import { resolveRequestId } from './request-id';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const requestId = resolveRequestId(request.header('x-request-id'));
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const client =
      status >= 500 || !(exception instanceof HttpException)
        ? { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' }
        : clientError(exception);

    if (status >= 500) {
      this.logger.error({ requestId, message: errorMessage(exception) }, 'request failed');
    }

    const body: ApiErrorBody = {
      error: {
        code: client.code,
        message: client.message,
        requestId,
      },
    };

    response.status(status).json(body);
  }
}
