import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskPhone } from 'src/common/utils/phone.util';

/// SMS delivery boundary. Today it logs; swap the body of `send` for MSG91 /
/// Twilio / AWS SNS without touching any caller.
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  async send(phone: string, message: string): Promise<void> {
    const env = this.config.get<string>('app.env');
    if (env === 'production') {
      // No provider wired up yet - fail loudly rather than silently dropping
      // a login OTP in production.
      this.logger.error(
        `No SMS provider configured; message to ${maskPhone(phone)} not sent`,
      );
      throw new Error('SMS provider not configured');
    }
    this.logger.log(`[SMS -> ${maskPhone(phone)}] ${message}`);
    return Promise.resolve();
  }

  async sendOtp(
    phone: string,
    code: string,
    ttlSeconds: number,
  ): Promise<void> {
    const minutes = Math.max(1, Math.round(ttlSeconds / 60));
    await this.send(
      phone,
      `${code} is your Swasth verification code. It expires in ${minutes} minute(s). Do not share it with anyone.`,
    );
  }
}
