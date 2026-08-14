import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  DevicePlatform,
  GymRole,
  GymUser,
  GymUserStatus,
  MemberSource,
  OtpPurpose,
} from '@prisma/client';
import { RequestGym } from 'src/common/types/authenticated-user.type';
import { maskPhone, toE164 } from 'src/common/utils/phone.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';
import { SessionContext, TokenPair, TokensService } from './tokens.service';

export interface AuthSession extends TokenPair {
  isNewUser: boolean;
  user: {
    id: string;
    phone: string;
    fullName: string | null;
    role: GymRole;
    memberCode: string | null;
    onboarded: boolean;
  };
  gym: { id: string; code: string; name: string };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokensService,
  ) {}

  async sendOtp(
    dto: SendOtpDto,
    gym: RequestGym,
  ): Promise<{ phone: string; expiresAt: Date; devCode?: string }> {
    const phone = toE164(dto.phone);
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { gymUsers: { where: { gymId: gym.id } } },
    });

    if (user && (!user.isActive || user.deletedAt)) {
      throw new UnauthorizedException(
        'This account has been deactivated. Contact support.',
      );
    }

    const link = user?.gymUsers[0];
    if (link && link.status === GymUserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        `Your access to ${gym.name} is suspended. Please contact the gym.`,
      );
    }

    const { expiresAt, devCode } = await this.otp.issue(
      phone,
      OtpPurpose.LOGIN,
      user?.id,
    );

    this.logger.log(`OTP issued for ${maskPhone(phone)} at ${gym.code}`);
    return {
      phone: maskPhone(phone),
      expiresAt,
      ...(devCode ? { devCode } : {}),
    };
  }

  /// Verifies the OTP and logs the user in at this gym. Creates the person on
  /// first use anywhere, and links them to this gym on first use here.
  async verifyOtp(
    dto: VerifyOtpDto,
    gym: RequestGym,
    context: SessionContext = {},
  ): Promise<AuthSession> {
    const phone = toE164(dto.phone);
    await this.otp.verify(phone, dto.code, OtpPurpose.LOGIN);

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    const isNewUser = !existing;

    if (existing && (!existing.isActive || existing.deletedAt)) {
      throw new UnauthorizedException(
        'This account has been deactivated. Contact support.',
      );
    }

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { phoneVerified: true, lastLoginAt: new Date() },
        })
      : await this.prisma.user.create({
          data: { phone, phoneVerified: true, lastLoginAt: new Date() },
        });

    const gymUser = await this.resolveGymUser(user.id, gym);

    const deviceId = dto.platform
      ? await this.registerDevice(user.id, dto)
      : undefined;

    const pair = await this.tokens.issuePair(user, gymUser, {
      ...context,
      deviceId,
    });

    return {
      ...pair,
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: gymUser.role,
        memberCode: gymUser.memberCode,
        onboarded: gymUser.onboardedAt !== null,
      },
      gym: { id: gym.id, code: gym.code, name: gym.name },
    };
  }

  async refresh(
    token: string,
    context: SessionContext = {},
  ): Promise<TokenPair> {
    return this.tokens.rotate(token, context);
  }

  async logout(token: string): Promise<void> {
    await this.tokens.revokeByToken(token);
  }

  async logoutAll(userId: string, gymId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId, gymId);
  }

  /// Someone logging into a gym's app for the first time becomes a MEMBER of
  /// that gym straight away. They hold no paid membership yet - that is a
  /// separate record - so at this point they can look around but not much else.
  private async resolveGymUser(
    userId: string,
    gym: RequestGym,
  ): Promise<GymUser> {
    const existing = await this.prisma.gymUser.findUnique({
      where: { gymId_userId: { gymId: gym.id, userId } },
    });

    if (existing) {
      if (existing.status !== GymUserStatus.ACTIVE) {
        throw new UnauthorizedException(
          `Your access to ${gym.name} is not active. Please contact the gym.`,
        );
      }
      return existing;
    }

    return this.prisma.gymUser.create({
      data: {
        gymId: gym.id,
        userId,
        role: GymRole.MEMBER,
        source: MemberSource.APP_SIGNUP,
      },
    });
  }

  private async registerDevice(
    userId: string,
    dto: VerifyOtpDto,
  ): Promise<string> {
    const platform = dto.platform as DevicePlatform;

    // pushToken is part of the uniqueness key, so a device without one is
    // matched on (userId, null) and simply refreshed.
    const existing = await this.prisma.device.findFirst({
      where: { userId, pushToken: dto.pushToken ?? null },
    });

    if (existing) {
      const updated = await this.prisma.device.update({
        where: { id: existing.id },
        data: {
          platform,
          appVersion: dto.appVersion ?? existing.appVersion,
          lastSeenAt: new Date(),
        },
      });
      return updated.id;
    }

    const created = await this.prisma.device.create({
      data: {
        userId,
        platform,
        pushToken: dto.pushToken ?? null,
        appVersion: dto.appVersion ?? null,
      },
    });
    return created.id;
  }
}
