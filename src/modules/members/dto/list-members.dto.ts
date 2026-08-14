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
