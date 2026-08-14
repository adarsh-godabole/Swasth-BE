import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OtpConfig } from 'src/config/configuration';
import { SmsService } from '../notifications/sms.service';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sms: SmsService,
  ) {}

  private get options(): OtpConfig {
    return this.config.getOrThrow<OtpConfig>('otp');
  }

  /// Issues an OTP for a phone number. Returns the code only in dev mode so the
  /// mobile team can test without an SMS gateway.
  async issue(
    phone: string,
    purpose: OtpPurpose = OtpPurpose.LOGIN,
    userId?: string,
  ): Promise<{ expiresAt: Date; devCode?: string }> {
    const { ttlSeconds, resendCooldownSeconds, devMode, devCode } =
      this.options;

    const lastRequest = await this.prisma.otpRequest.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (lastRequest && resendCooldownSeconds > 0) {
      const elapsedMs = Date.now() - lastRequest.createdAt.getTime();
      const cooldownMs = resendCooldownSeconds * 1000;
      if (elapsedMs < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
        throw new BadRequestException(
          `Please wait ${waitSeconds} second(s) before requesting another OTP`,
        );
      }
    }

    const code = devMode && devCode ? devCode : this.generateCode();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.$transaction([
      // Any previously issued, still-live OTP for this phone is retired so only
      // the newest code can be redeemed.
      this.prisma.otpRequest.updateMany({
        where: {
          phone,
          purpose,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpRequest.create({
        data: {
          phone,
          userId: userId ?? null,
          purpose,
          codeHash: await argon2.hash(code),
          expiresAt,
        },
      }),
    ]);

    await this.sms.sendOtp(phone, code, ttlSeconds);

    return { expiresAt, ...(devMode ? { devCode: code } : {}) };
  }

  /// Verifies and consumes an OTP. Throws on expiry, exhausted attempts or a
  /// wrong code.
  async verify(
    phone: string,
    code: string,
    purpose: OtpPurpose = OtpPurpose.LOGIN,
  ): Promise<void> {
    const { maxAttempts } = this.options;

    const request = await this.prisma.otpRequest.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!request) {
      throw new UnauthorizedException(
        'No active OTP found. Request a new one.',
      );
    }
    if (request.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('OTP has expired. Request a new one.');
    }
    if (request.attempts >= maxAttempts) {
      throw new UnauthorizedException(
        'Too many incorrect attempts. Request a new OTP.',
      );
    }

    const matches = await argon2.verify(request.codeHash, code);
    if (!matches) {
      await this.prisma.otpRequest.update({
        where: { id: request.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = maxAttempts - (request.attempts + 1);
      throw new UnauthorizedException(
        remaining > 0
          ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
          : 'Incorrect OTP. Request a new one.',
      );
    }

    await this.prisma.otpRequest.update({
      where: { id: request.id },
      data: { consumedAt: new Date() },
    });
  }

  private generateCode(): string {
    const { length } = this.options;
    const max = 10 ** length;
    return randomInt(0, max).toString().padStart(length, '0');
  }
}
