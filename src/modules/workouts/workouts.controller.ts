import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
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
import { GymStaffOnly } from 'src/common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  RequestGym,
} from 'src/common/types/authenticated-user.type';
import { GYM_HEADER } from '../gyms/gym-context.middleware';
import {
  ListWorkoutsDto,
  WorkoutSummaryQueryDto,
} from './dto/list-workouts.dto';
import { UpsertWorkoutDto } from './dto/upsert-workout.dto';
import { WorkoutsService } from './workouts.service';

@ApiTags('Workouts')
@ApiBearerAuth()
@ApiHeader({ name: GYM_HEADER, required: true })
@RequireGym()
@Controller()
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  /// PUT rather than POST: the app saves on every tap of the body map, so this
  /// has to be safe to repeat. There is deliberately no DELETE - clearing the
  /// selection is an empty muscleGroups array.
  @Put('workouts/me/today')
  @ApiOperation({ summary: "Log what I'm training today" })
  upsertToday(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentGym() gym: RequestGym,
    @Body() dto: UpsertWorkoutDto,
  ) {
    return this.workouts.upsertToday(gym, user.gymUserId, dto);
  }

  @Get('workouts/me')
  @ApiOperation({ summary: 'My workout history, most recent day first' })
  myHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWorkoutsDto,
  ) {
    return this.workouts.history(user.gymId, user.gymUserId, query.limit);
  }

  @Get('workouts/me/summary')
  @ApiOperation({
    summary: 'Which areas I have trained recently, and how often',
  })
  mySummary(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentGym() gym: RequestGym,
    @Query() query: WorkoutSummaryQueryDto,
  ) {
    return this.workouts.summary(gym, user.gymUserId, query.days);
  }

  // ---- Staff ----

  @Get('members/:memberId/workouts')
  @GymStaffOnly()
  @ApiOperation({ summary: "A member's workout history" })
  memberHistory(
    @CurrentUser('gymId') gymId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Query() query: ListWorkoutsDto,
  ) {
    return this.workouts.history(gymId, memberId, query.limit);
  }
}
