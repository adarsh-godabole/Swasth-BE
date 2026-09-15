import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentGym,
  RequireGym,
} from 'src/common/decorators/current-gym.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { GymStaffOnly } from 'src/common/decorators/roles.decorator';
import { PlatformAdminGuard } from 'src/common/guards/platform-admin.guard';
import { GYM_HEADER } from './gym-context.middleware';
import { CreateGymDto } from './dto/create-gym.dto';
import { GymsService } from './gyms.service';

@ApiTags('Gyms')
@Controller('gyms')
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @Public()
  @RequireGym()
  @Get('current')
  @ApiHeader({ name: GYM_HEADER, required: true })
  @ApiOperation({
    summary:
      'Profile of the gym this app build belongs to (shown before login)',
  })
  current(@CurrentGym('id') gymId: string) {
    return this.gymsService.publicProfile(gymId);
  }

  /// What staff print or display at the door. Staff-only: it is not secret
  /// enough to matter much, but there is no reason to hand it to members
  /// through the API when it is already on a poster in front of them.
  @RequireGym()
  @GymStaffOnly()
  @ApiBearerAuth()
  @ApiHeader({ name: GYM_HEADER, required: true })
  @Get('current/check-in-code')
  @ApiOperation({ summary: "The gym's door QR check-in code" })
  doorCode(@CurrentUser('gymId') gymId: string) {
    return this.gymsService.doorCode(gymId);
  }

  /// For when a poster ends up somewhere it shouldn't. Every printed copy of
  /// the old code stops working immediately.
  @RequireGym()
  @GymStaffOnly()
  @ApiBearerAuth()
  @ApiHeader({ name: GYM_HEADER, required: true })
  @Post('current/check-in-code/rotate')
  @ApiOperation({ summary: 'Issue a new door code and void the printed one' })
  rotateDoorCode(@CurrentUser('gymId') gymId: string) {
    return this.gymsService.rotateCheckInCode(gymId);
  }

  @Post()
  @UseGuards(PlatformAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Onboard a new gym (Swasth team only)' })
  create(@Body() dto: CreateGymDto) {
    return this.gymsService.create(dto);
  }

  @Get()
  @UseGuards(PlatformAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List every gym (Swasth team only)' })
  list() {
    return this.gymsService.list();
  }
}
