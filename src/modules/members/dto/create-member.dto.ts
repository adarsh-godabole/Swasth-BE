import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityLevel, FitnessGoal, Gender } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/// Used by the front desk to register a walk-in. The member does not need to
/// have installed the app - when they later log in with this number, this
/// record is already waiting for them.
export class CreateMemberDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: 'Rohit Sharma' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({ example: 'rohit@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '1995-04-17' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 175.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(50)
  @Max(280)
  heightCm?: number;

  @ApiPropertyOptional({ example: 82.4 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(20)
  @Max(500)
  weightKg?: number;

  @ApiPropertyOptional({ enum: FitnessGoal })
  @IsOptional()
  @IsEnum(FitnessGoal)
  goal?: FitnessGoal;

  @ApiPropertyOptional({ enum: ActivityLevel })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  @ApiPropertyOptional({
    example: 'Left knee surgery in 2023 - avoid heavy squats',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  medicalNotes?: string;

  @ApiPropertyOptional({ example: 'Sunita Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+919812345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ description: 'Front-desk notes about this member' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
