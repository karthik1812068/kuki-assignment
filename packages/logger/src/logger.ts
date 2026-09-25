import { Writable } from 'node:stream';
import pino, { type DestinationStream, type Logger } from 'pino';
import { getLogContext } from './context';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'llmApiKey',
  'githubClientSecret',
  'jwtSecret',
  'encryptionKey',
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.accessToken',
  '*.access_token',
  '*.authorization',
  '*.ciphertext',
  '*.codeVerifier',
  'codeVerifier',
  'ciphertext',
];

export interface LoggerOptions {
  level?: string;
  destination?: DestinationStream;
}

export function createLogger(service: string, options: LoggerOptions = {}): Logger {
  const loggerOptions = {
    level: options.level ?? 'info',
    base: { service },
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    mixin() {
      return Object.fromEntries(
        Object.entries(getLogContext()).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (options.destination) {
    return pino(loggerOptions, options.destination);
  }

  return pino(loggerOptions);
}

export function captureLogs(): { destination: DestinationStream; read: () => string } {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
      callback();
    },
  });

  return {
    destination,
    read: () => chunks.join(''),
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}
