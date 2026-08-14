import { ApiPropertyOptional } from '@nestjs/swagger';
import { GymUserStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateMemberDto {
  @ApiPropertyOptional({
    enum: [GymUserStatus.LEFT, GymUserStatus.SUSPENDED],
    default: GymUserStatus.LEFT,
    description:
      'LEFT for someone who has quit, SUSPENDED for a temporary block',
  })
  @IsOptional()
  @IsIn([GymUserStatus.LEFT, GymUserStatus.SUSPENDED])
  status: 'LEFT' | 'SUSPENDED' = GymUserStatus.LEFT;

  @ApiPropertyOptional({ example: 'Moved to another city' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
