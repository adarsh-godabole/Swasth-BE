import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Adarsh Godabole' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ example: 'adarsh@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '1995-04-17', description: 'ISO date' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 175.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(50)
  @Max(280)
  heightCm?: number;

  @ApiPropertyOptional({ example: 72.4 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(20)
  @Max(500)
  weightKg?: number;

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}
