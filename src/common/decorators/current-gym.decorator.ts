import {
  BadRequestException,
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestGym } from '../types/authenticated-user.type';
import { GYM_HEADER } from 'src/modules/gyms/gym-context.middleware';

export const REQUIRE_GYM_KEY = 'requireGym';

/// Marks a route as needing the X-Gym-Code header. Enforced by GymGuard.
export const RequireGym = () => SetMetadata(REQUIRE_GYM_KEY, true);

export const CurrentGym = createParamDecorator(
  (data: keyof RequestGym | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { gym?: RequestGym }>();
    if (!request.gym) {
      throw new BadRequestException(`${GYM_HEADER} header is required`);
    }
    return data ? request.gym[data] : request.gym;
  },
);
