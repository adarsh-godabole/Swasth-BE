import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CheckInSource } from '@prisma/client';
import {
  CurrentGym,
  RequireGym,
} from 'src/common/decorators/current-gym.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { GymStaffOnly } from 'src/common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  RequestGym,
} from 'src/common/types/authenticated-user.type';
import { GYM_HEADER } from '../gyms/gym-context.middleware';
import { CheckInsService } from './check-ins.service';

@ApiTags('Check-ins')
@ApiBearerAuth()
@ApiHeader({ name: GYM_HEADER, required: true })
@RequireGym()
@Controller()
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService) {}

  /// The member's own "Check in" button. The app asks "are you sure you're at
  /// the gym?" before calling this - the confirmation is entirely client-side,
  /// there is nothing to send.
  @Post('check-ins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check myself in for today' })
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentGym() gym: RequestGym,
  ) {
    return this.checkIns.checkIn(gym, user.gymUserId, CheckInSource.APP);
  }

  @Get('check-ins/me/summary')
  @ApiOperation({ summary: 'My streak and visit counts' })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentGym() gym: RequestGym,
  ) {
    return this.checkIns.summary(gym, user.gymUserId);
  }

  @Get('check-ins/me')
  @ApiOperation({ summary: 'My visit history' })
  @ApiQuery({ name: 'limit', required: false, example: 30 })
  myHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
  ) {
    return this.checkIns.history(
      user.gymId,
      user.gymUserId,
      Math.min(Math.max(limit, 1), 200),
    );
  }

  // ---- Staff ----

  @Get('check-ins')
  @GymStaffOnly()
  @ApiOperation({ summary: 'Attendance for a day, defaulting to today' })
  @ApiQuery({ name: 'date', required: false, example: '2026-08-14' })
  listForDay(@CurrentGym() gym: RequestGym, @Query('date') date?: string) {
    return this.checkIns.listForDay(gym, date);
  }

  @Post('members/:memberId/check-ins')
  @GymStaffOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check a member in from the front desk' })
  checkInMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentGym() gym: RequestGym,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.checkIns.checkIn(
      gym,
      memberId,
      CheckInSource.FRONT_DESK,
      user.gymUserId,
    );
  }

  @Get('members/:memberId/check-ins')
  @GymStaffOnly()
  @ApiOperation({ summary: "A member's visit history" })
  @ApiQuery({ name: 'limit', required: false, example: 30 })
  memberHistory(
    @CurrentUser('gymId') gymId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
  ) {
    return this.checkIns.history(
      gymId,
      memberId,
      Math.min(Math.max(limit, 1), 200),
    );
  }
}
