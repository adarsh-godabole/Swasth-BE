import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  // AuthModule provides TokensService, used to end a deactivated member's
  // sessions immediately.
  imports: [AuthModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
