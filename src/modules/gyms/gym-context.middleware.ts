import {
  BadRequestException,
  Injectable,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestGym } from 'src/common/types/authenticated-user.type';
import { PrismaService } from 'src/prisma/prisma.service';

export const GYM_HEADER = 'x-gym-code';

/// Resolves the `X-Gym-Code` header into a gym and hangs it off the request.
///
/// The header is optional here rather than mandatory, because a few routes are
/// gym-less (health, platform admin creating a gym). Routes that need a gym say
/// so with @RequireGym(); everything else simply never reads request.gym.
@Injectable()
export class GymContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const raw = req.headers[GYM_HEADER];
    if (!raw) {
      next();
      return;
    }

    const code = (Array.isArray(raw) ? raw[0] : raw).trim().toLowerCase();
    if (!code) {
      throw new BadRequestException(`${GYM_HEADER} header cannot be empty`);
    }

    const gym = await this.prisma.gym.findFirst({
      where: { code, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        timezone: true,
        currency: true,
        isActive: true,
      },
    });

    if (!gym) {
      throw new NotFoundException(`Unknown gym "${code}"`);
    }
    if (!gym.isActive) {
      throw new NotFoundException(`${gym.name} is not currently active`);
    }

    (req as Request & { gym: RequestGym }).gym = gym;
    next();
  }
}
