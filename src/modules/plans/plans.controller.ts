import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GymRole } from '@prisma/client';
import { RequireGym } from 'src/common/decorators/current-gym.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { GymStaffOnly } from 'src/common/decorators/roles.decorator';
import { AuthenticatedUser } from 'src/common/types/authenticated-user.type';
import { GYM_HEADER } from '../gyms/gym-context.middleware';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

@ApiTags('Plans')
@ApiBearerAuth()
@ApiHeader({ name: GYM_HEADER, required: true })
@RequireGym()
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  /// Open to members too: this is the "what can I buy" list in the app. Members
  /// only ever see active, public plans.
  @Get()
  @ApiOperation({ summary: 'List plans (members see only public ones)' })
  list(@CurrentUser() user: AuthenticatedUser) {
    const isStaff =
      user.role === GymRole.GYM_ADMIN || user.role === GymRole.OWNER;
    return this.plansService.list(user.gymId, !isStaff);
  }

  @Get(':id')
  @GymStaffOnly()
  @ApiOperation({ summary: 'Get one plan' })
  findOne(
    @CurrentUser('gymId') gymId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plansService.findOne(gymId, id);
  }

  @Post()
  @GymStaffOnly()
  @ApiOperation({ summary: 'Create a plan' })
  create(@CurrentUser('gymId') gymId: string, @Body() dto: CreatePlanDto) {
    return this.plansService.create(gymId, dto);
  }

  @Patch(':id')
  @GymStaffOnly()
  @ApiOperation({
    summary: 'Update a plan (does not affect subscriptions already sold)',
  })
  update(
    @CurrentUser('gymId') gymId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.update(gymId, id, dto);
  }

  @Post(':id/archive')
  @GymStaffOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Take a plan off sale, keeping its history' })
  archive(
    @CurrentUser('gymId') gymId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plansService.archive(gymId, id);
  }

  @Post(':id/restore')
  @GymStaffOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Put an archived plan back on sale' })
  restore(
    @CurrentUser('gymId') gymId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plansService.restore(gymId, id);
  }
}
