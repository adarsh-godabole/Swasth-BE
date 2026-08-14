import {
  Body,
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
  ApiTags,
} from '@nestjs/swagger';
import { RequireGym } from 'src/common/decorators/current-gym.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { GymStaffOnly } from 'src/common/decorators/roles.decorator';
import { AuthenticatedUser } from 'src/common/types/authenticated-user.type';
import { GYM_HEADER } from '../gyms/gym-context.middleware';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Memberships')
@ApiBearerAuth()
@ApiHeader({ name: GYM_HEADER, required: true })
@RequireGym()
@GymStaffOnly()
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post('members/:memberId/subscriptions')
  @ApiOperation({ summary: 'Sell a plan to a member' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptions.create(user.gymId, memberId, dto, user.gymUserId);
  }

  @Get('members/:memberId/subscriptions')
  @ApiOperation({ summary: "A member's membership history" })
  list(
    @CurrentUser('gymId') gymId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.subscriptions.listForMember(gymId, memberId);
  }

  @Get('subscriptions/expiring')
  @ApiOperation({
    summary: 'Memberships expiring soon, with the member to call',
  })
  expiring(
    @CurrentUser('gymId') gymId: string,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.subscriptions.expiring(gymId, Math.min(Math.max(days, 1), 90));
  }

  @Post('subscriptions/:id/payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record more cash against a part-paid membership' })
  recordPayment(
    @CurrentUser('gymId') gymId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.subscriptions.recordPayment(gymId, id, dto);
  }

  @Post('subscriptions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a membership' })
  cancel(
    @CurrentUser('gymId') gymId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subscriptions.cancel(gymId, id, dto);
  }
}
