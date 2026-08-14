import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import {
  CurrentGym,
  RequireGym,
} from 'src/common/decorators/current-gym.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { RequestGym } from 'src/common/types/authenticated-user.type';
import { GYM_HEADER } from '../gyms/gym-context.middleware';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SessionContext } from './tokens.service';

@ApiTags('Auth')
@ApiHeader({
  name: GYM_HEADER,
  description: 'Gym the app is built for, e.g. swasth-koramangala',
  required: true,
})
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RequireGym()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a login OTP to a mobile number' })
  sendOtp(@Body() dto: SendOtpDto, @CurrentGym() gym: RequestGym) {
    return this.authService.sendOtp(dto, gym);
  }

  @Public()
  @RequireGym()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify an OTP and log in; joins the gym on first login',
  })
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @CurrentGym() gym: RequestGym,
    @Req() req: Request,
  ) {
    return this.authService.verifyOtp(dto, gym, this.sessionContext(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.sessionContext(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a single refresh token' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke every session this user holds at the current gym',
  })
  async logoutAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('gymId') gymId: string,
  ): Promise<void> {
    await this.authService.logoutAll(userId, gymId);
  }

  private sessionContext(req: Request): SessionContext {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }
}
