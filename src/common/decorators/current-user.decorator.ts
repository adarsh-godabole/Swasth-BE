import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/authenticated-user.type';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    return data ? request.user?.[data] : request.user;
  },
);
