import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/authenticated-user.type';

/// Guards the handful of routes that belong to the Swasth team rather than to
/// any one gym - onboarding a new gym, listing all gyms.
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrators only');
    }
    return true;
  }
}
