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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the logged-in user profile' })
  me(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the logged-in user profile' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('me/onboarding/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark onboarding as complete' })
  completeOnboarding(@CurrentUser('id') userId: string) {
    return this.usersService.completeOnboarding(userId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete the logged-in account' })
  async deleteMe(@CurrentUser('id') userId: string): Promise<void> {
    await this.usersService.deleteAccount(userId);
  }
}
