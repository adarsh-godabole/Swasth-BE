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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireGym } from 'src/common/decorators/current-gym.decorator';
import { GymStaffOnly } from 'src/common/decorators/roles.decorator';
import { GYM_HEADER } from '../gyms/gym-context.middleware';
import { CreateMemberDto } from './dto/create-member.dto';
import { DeactivateMemberDto } from './dto/deactivate-member.dto';
import { ListMembersDto } from './dto/list-members.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MembersService } from './members.service';

/// Front-desk member administration. Every route is scoped to the caller's own
/// gym - the gym id comes from their token, never from the request body, so
/// staff at one gym cannot read or touch another gym's members.
@ApiTags('Members')
@ApiBearerAuth()
@ApiHeader({ name: GYM_HEADER, required: true })
@RequireGym()
@GymStaffOnly()
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new member at the front desk' })
  create(@CurrentUser('gymId') gymId: string, @Body() dto: CreateMemberDto) {
    return this.membersService.create(gymId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Search and list members of this gym' })
  list(@CurrentUser('gymId') gymId: string, @Query() query: ListMembersDto) {
    return this.membersService.list(gymId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one member' })
  findOne(
    @CurrentUser('gymId') gymId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.findOne(gymId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a member' })
  update(
    @CurrentUser('gymId') gymId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.update(gymId, id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a member or mark them as having left' })
  deactivate(
    @CurrentUser('gymId') gymId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeactivateMemberDto,
  ) {
    return this.membersService.deactivate(gymId, id, dto);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore access for a suspended or departed member',
  })
  reactivate(
    @CurrentUser('gymId') gymId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.reactivate(gymId, id);
  }
}
