import { ApiPropertyOptional } from '@nestjs/swagger';
import { GymUserStatus, MemberSource } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class MemberStatsDto {
  @ApiPropertyOptional({
    default: 7,
    description: 'Window that defines "expiring soon"',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  expiringInDays = 7;

  @ApiPropertyOptional({
    enum: GymUserStatus,
    description: 'Narrow the population, to match a filtered list',
  })
  @IsOptional()
  @IsEnum(GymUserStatus)
  status?: GymUserStatus;

  @ApiPropertyOptional({ enum: MemberSource })
  @IsOptional()
  @IsEnum(MemberSource)
  source?: MemberSource;
}
