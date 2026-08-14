import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { GYM_HEADER } from '../gyms/gym-context.middleware';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@ApiHeader({ name: GYM_HEADER, required: true })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my profile and my standing at this gym' })
  me(@CurrentUser('id') userId: string, @CurrentUser('gymId') gymId: string) {
    return this.usersService.findMe(userId, gymId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update my profile' })
  updateMe(
    @CurrentUser('id') userId: string,
    @CurrentUser('gymId') gymId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(userId, gymId, dto);
  }

  @Post('me/onboarding/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark onboarding at this gym as complete' })
  completeOnboarding(
    @CurrentUser('id') userId: string,
    @CurrentUser('gymId') gymId: string,
  ) {
    return this.usersService.completeOnboarding(userId, gymId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete my account across every gym' })
  async deleteMe(@CurrentUser('id') userId: string): Promise<void> {
    await this.usersService.deleteAccount(userId);
  }
}
