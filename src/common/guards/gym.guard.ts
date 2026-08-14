import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_GYM_KEY } from '../decorators/current-gym.decorator';
import {
  AuthenticatedUser,
  RequestGym,
} from '../types/authenticated-user.type';
import { GYM_HEADER } from 'src/modules/gyms/gym-context.middleware';

/// Two jobs:
///   1. Reject @RequireGym() routes that arrive without a resolved gym.
///   2. Reject any authenticated request whose token was minted for a different
///      gym than the one in the header - a token from gym A must be inert
///      against gym B.
@Injectable()
export class GymGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { gym?: RequestGym; user?: AuthenticatedUser }>();

    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_GYM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (required && !req.gym) {
      throw new BadRequestException(`${GYM_HEADER} header is required`);
    }

    if (req.user && req.gym && req.user.gymId !== req.gym.id) {
      throw new ForbiddenException('This session belongs to a different gym');
    }

    return true;
  }
}
