import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DurationUnit } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: '3 Months' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ example: 'Full gym access, all equipment' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 3, description: 'How many units the plan runs for' })
  @IsInt()
  @Min(1)
  @Max(120)
  durationValue!: number;

  @ApiProperty({ enum: DurationUnit, example: DurationUnit.MONTH })
  @IsEnum(DurationUnit)
  durationUnit!: DurationUnit;

  @ApiProperty({ example: 4500, description: 'Price in rupees' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  price!: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Can still be sold at the front desk',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Also visible to members in the app',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ default: 0, description: 'Lower sorts first' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
