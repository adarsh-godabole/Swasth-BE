import { ApiPropertyOptional } from '@nestjs/swagger';
import { GymUserStatus, MemberSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListMembersDto {
  @ApiPropertyOptional({
    description: 'Matches name, phone or member code',
    example: 'rohit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: GymUserStatus })
  @IsOptional()
  @IsEnum(GymUserStatus)
  status?: GymUserStatus;

  @ApiPropertyOptional({ enum: MemberSource })
  @IsOptional()
  @IsEnum(MemberSource)
  source?: MemberSource;

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'EXPIRING', 'ACTIVE_NOT_EXPIRING', 'EXPIRED', 'NONE'],
    description:
      'ACTIVE = holds a live membership, and is a SUPERSET of EXPIRING. ' +
      'EXPIRING = active and ending within expiringInDays. ' +
      'ACTIVE_NOT_EXPIRING = active but not expiring soon - the disjoint slice. ' +
      'EXPIRED = has history but nothing live (includes cancelled). ' +
      'NONE = never bought a membership. ' +
      'These do NOT sum to the member count - use GET /members/stats instead.',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'EXPIRING', 'ACTIVE_NOT_EXPIRING', 'EXPIRED', 'NONE'])
  membershipStatus?:
    'ACTIVE' | 'EXPIRING' | 'ACTIVE_NOT_EXPIRING' | 'EXPIRED' | 'NONE';

  @ApiPropertyOptional({
    default: 7,
    description: 'Window used by membershipStatus=EXPIRING',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  expiringInDays = 7;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    enum: ['joinedAt', 'fullName', 'lastVisitAt'],
    default: 'joinedAt',
  })
  @IsOptional()
  @IsIn(['joinedAt', 'fullName', 'lastVisitAt'])
  sortBy: 'joinedAt' | 'fullName' | 'lastVisitAt' = 'joinedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
