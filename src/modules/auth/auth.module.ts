import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokensService } from './tokens.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Secrets are passed per-signing call so access and refresh tokens can use
    // different keys.
    JwtModule.register({}),
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokensService, JwtStrategy],
  exports: [AuthService, TokensService],
})
export class AuthModule {}
