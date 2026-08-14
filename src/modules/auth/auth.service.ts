import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { DevicePlatform, OtpPurpose, User } from '@prisma/client';
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
    role: User['role'];
    onboarded: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokensService,
  ) {}

  async sendOtp(dto: SendOtpDto): Promise<{
    phone: string;
    expiresAt: Date;
    devCode?: string;
  }> {
    const phone = toE164(dto.phone);
    const user = await this.prisma.user.findUnique({ where: { phone } });

    if (user && (!user.isActive || user.deletedAt)) {
      throw new UnauthorizedException(
        'This account has been deactivated. Contact support.',
      );
    }

    const { expiresAt, devCode } = await this.otp.issue(
      phone,
      OtpPurpose.LOGIN,
      user?.id,
    );

    this.logger.log(`OTP issued for ${maskPhone(phone)}`);
    return {
      phone: maskPhone(phone),
      expiresAt,
      ...(devCode ? { devCode } : {}),
    };
  }

  /// Verifies the OTP and logs the user in, creating the account on first use.
  async verifyOtp(
    dto: VerifyOtpDto,
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
          data: {
            phone,
            phoneVerified: true,
            lastLoginAt: new Date(),
          },
        });

    const deviceId = dto.platform
      ? await this.registerDevice(user.id, dto)
      : undefined;

    const pair = await this.tokens.issuePair(user, { ...context, deviceId });

    return {
      ...pair,
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        onboarded: user.onboardedAt !== null,
      },
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

  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
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
