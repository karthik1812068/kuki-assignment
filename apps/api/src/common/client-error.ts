import { HttpException } from '@nestjs/common';

const ERROR_CODE = /^[A-Z0-9_]{1,64}$/;

export function clientError(exception: HttpException): { code: string; message: string } {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return { code: 'REQUEST_ERROR', message: body.slice(0, 300) };
  }

  if (typeof body === 'object' && body) {
    const record = body as Record<string, unknown>;
    const code =
      typeof record.code === 'string' && ERROR_CODE.test(record.code)
        ? record.code
        : 'REQUEST_ERROR';
    const raw = record.message;
    const message = Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === 'string').join(' ')
      : typeof raw === 'string'
        ? raw
        : exception.message;
    return { code, message: message.slice(0, 300) };
  }

  return { code: 'REQUEST_ERROR', message: exception.message.slice(0, 300) };
}
