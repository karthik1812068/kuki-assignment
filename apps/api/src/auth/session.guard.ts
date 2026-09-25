import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { requestContext } from '@codepilot/logger';
import type { CurrentUser } from '@codepilot/types';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export type AuthenticatedRequest = Request & { currentUser: CurrentUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { currentUser?: CurrentUser }>();
    const user = await this.auth.currentUser(request.headers.cookie);
    if (!user) {
      throw new HttpException(
        { code: 'UNAUTHENTICATED', message: 'Sign in is required.' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    request.currentUser = user;
    const store = requestContext.getStore();
    if (store) {
      store.userId = user.id;
    }
    return true;
  }
}
