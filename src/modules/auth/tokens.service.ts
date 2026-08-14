import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GymUser, GymUserStatus, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from 'src/common/types/authenticated-user.type';
import { JwtConfig } from 'src/config/configuration';
import { PrismaService } from 'src/prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionContext {
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get options(): JwtConfig {
    return this.config.getOrThrow<JwtConfig>('jwt');
  }

  /// Tokens are always minted for one gym. The role is copied from the caller's
  /// GymUser row, so it is the role at *that* gym.
  async issuePair(
    user: User,
    gymUser: Pick<GymUser, 'gymId' | 'role'>,
    context: SessionContext = {},
    familyId: string = randomUUID(),
  ): Promise<TokenPair> {
    const { accessSecret, accessTtl, refreshSecret, refreshTtl } = this.options;

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      phone: user.phone,
      gymId: gymUser.gymId,
      role: gymUser.role,
    };

    // Signed with seconds rather than the "15m" string: the same parsed value
    // then drives both the JWT expiry and the expiresIn we hand the client.
    const accessTtlSeconds = Math.floor(this.ttlToMs(accessTtl) / 1000);
    const refreshTtlMs = this.ttlToMs(refreshTtl);

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: accessSecret,
      expiresIn: accessTtlSeconds,
    });

    // The stored row is created first so its id can be embedded as the jti.
    const record = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        gymId: gymUser.gymId,
        familyId,
        tokenHash: '',
        deviceId: context.deviceId ?? null,
        userAgent: context.userAgent?.slice(0, 300) ?? null,
        ipAddress: context.ipAddress ?? null,
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    });

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      jti: record.id,
      gymId: gymUser.gymId,
      familyId,
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: refreshSecret,
      expiresIn: Math.floor(refreshTtlMs / 1000),
    });

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { tokenHash: await argon2.hash(refreshToken) },
    });

    return { accessToken, refreshToken, expiresIn: accessTtlSeconds };
  }

  /// Verifies a refresh token and rotates it. Reuse of an already-revoked token
  /// kills the whole family, on the assumption the token was stolen.
  async rotate(
    token: string,
    context: SessionContext = {},
  ): Promise<TokenPair> {
    const { refreshSecret } = this.options;

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: true },
    });

    if (!record || record.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user ${record.userId}; revoking family ${record.familyId}`,
      );
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const matches = await argon2.verify(record.tokenHash, token);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!record.user.isActive || record.user.deletedAt) {
      throw new UnauthorizedException('Account is not active');
    }

    // Re-read the membership so a role change or a suspension takes effect at
    // the next refresh rather than whenever the access token happens to expire.
    const gymUser = await this.prisma.gymUser.findUnique({
      where: { gymId_userId: { gymId: record.gymId, userId: record.userId } },
    });
    if (!gymUser || gymUser.status !== GymUserStatus.ACTIVE) {
      throw new UnauthorizedException('Your access to this gym is not active');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issuePair(
      record.user,
      gymUser,
      { deviceId: record.deviceId ?? undefined, ...context },
      record.familyId,
    );
  }

  async revokeByToken(token: string): Promise<void> {
    const { refreshSecret } = this.options;
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: refreshSecret,
      });
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Logging out with an already-invalid token is not an error worth
      // surfacing to the client.
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /// Ends every session for a person at one gym. Their sessions at other gyms
  /// are untouched.
  async revokeAllForUser(userId: string, gymId?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, ...(gymId ? { gymId } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  /// Converts "15m" / "30d" / "3600" into milliseconds.
  private ttlToMs(ttl: string): number {
    const match = /^(\d+)([smhd])?$/.exec(ttl.trim());
    if (!match) {
      throw new Error(`Unsupported TTL format: ${ttl}`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2] ?? 's';
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * multipliers[unit];
  }
}
