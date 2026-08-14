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
import { Public } from 'src/common/decorators/public.decorator';
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
