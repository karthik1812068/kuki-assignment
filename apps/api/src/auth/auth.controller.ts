import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Logger } from '@codepilot/logger';
import { SESSION_COOKIE_NAME, type CurrentUser } from '@codepilot/types';
import type { Request, Response } from 'express';
import { LOGGER } from '../logging/logger.token';
import { AuthFlowError, AuthService } from './auth.service';
import { cookiePolicy, sessionCookie } from './session-cookie';
import { SessionGuard, type AuthenticatedRequest } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  @Get('github')
  async start(@Query('next') next: unknown, @Res() response: Response): Promise<void> {
    try {
      const { url } = await this.auth.startLogin(next);
      response.redirect(HttpStatus.FOUND, url);
    } catch (error) {
      this.logFailure(error);
      this.redirectLogin(response, failureCode(error));
    }
  }

  @Get('github/callback')
  async callback(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Query('error') oauthError: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (oauthError === 'access_denied') {
      this.redirectLogin(response, 'access_denied');
      return;
    }
    if (typeof oauthError === 'string') {
      this.redirectLogin(response, 'oauth_failed');
      return;
    }

    try {
      const result = await this.auth.completeLogin({ code, state });
      this.setSessionCookie(request, response, result.sessionId, result.maxAgeSeconds);
      const destination = new URL(result.redirectPath, this.webOrigin());
      response.redirect(HttpStatus.SEE_OTHER, destination.toString());
    } catch (error) {
      this.logFailure(error);
      this.redirectLogin(response, failureCode(error));
    }
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res() response: Response): Promise<void> {
    try {
      await this.auth.revokeCookie(request.headers.cookie);
    } catch (error) {
      this.logFailure(error);
    }
    this.setSessionCookie(request, response, '', 0);
    this.redirectLogin(response);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthenticatedRequest): CurrentUser {
    return request.currentUser;
  }

  private setSessionCookie(
    request: Request,
    response: Response,
    value: string,
    maxAgeSeconds: number,
  ): void {
    const policy = cookiePolicy(this.webOrigin(), request.hostname);
    response.setHeader(
      'Set-Cookie',
      sessionCookie(SESSION_COOKIE_NAME, value, {
        maxAgeSeconds,
        secure: policy.secure,
        sameSite: policy.sameSite,
      }),
    );
  }

  private redirectLogin(response: Response, code?: string): void {
    const url = new URL('/login', this.webOrigin());
    if (code) {
      url.searchParams.set('error', code);
    }
    response.redirect(HttpStatus.SEE_OTHER, url.toString());
  }

  private webOrigin(): string {
    return this.config.getOrThrow<string>('WEB_ORIGIN');
  }

  private logFailure(error: unknown): void {
    const name = error instanceof Error ? error.name : 'Error';
    const code = error instanceof AuthFlowError ? error.reason : undefined;
    this.logger.warn({ name, code }, 'authentication failed');
  }
}

function failureCode(error: unknown): string {
  if (!(error instanceof AuthFlowError)) {
    return 'oauth_failed';
  }
  if (error.reason === 'not_configured') {
    return 'github_not_configured';
  }
  if (error.reason === 'unavailable') {
    return 'session_unavailable';
  }
  return 'oauth_failed';
}
