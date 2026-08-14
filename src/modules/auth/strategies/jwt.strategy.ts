import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { GymUserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AccessTokenPayload,
  AuthenticatedUser,
} from 'src/common/types/authenticated-user.type';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    // The role is re-read from the database rather than trusted from the token,
    // so revoking someone's access takes effect immediately.
    const gymUser = await this.prisma.gymUser.findUnique({
      where: {
        gymId_userId: { gymId: payload.gymId, userId: payload.sub },
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            isActive: true,
            deletedAt: true,
            isPlatformAdmin: true,
          },
        },
        gym: { select: { isActive: true, deletedAt: true } },
      },
    });

    if (!gymUser || !gymUser.user.isActive || gymUser.user.deletedAt) {
      throw new UnauthorizedException('Account is not active');
    }
    if (!gymUser.gym.isActive || gymUser.gym.deletedAt) {
      throw new UnauthorizedException('This gym is not currently active');
    }
    if (gymUser.status !== GymUserStatus.ACTIVE) {
      throw new UnauthorizedException('Your access to this gym is not active');
    }

    return {
      id: gymUser.user.id,
      phone: gymUser.user.phone,
      gymId: gymUser.gymId,
      gymUserId: gymUser.id,
      role: gymUser.role,
      isPlatformAdmin: gymUser.user.isPlatformAdmin,
    };
  }
}
