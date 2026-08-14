import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityLevel, FitnessGoal, Gender } from '@prisma/client';
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
  ValidateIf,
} from 'class-validator';

/// PATCH semantics throughout: omit a field to leave it alone, send `null` to
/// clear it. See src/common/utils/patch.util.ts.
const notNull = () => ValidateIf((_object, value) => value !== null);

export class UpdateProfileDto {
  // --- Person-level: shared everywhere this phone number is known ---

  @ApiPropertyOptional({ example: 'Adarsh Godabole', nullable: true })
  @IsOptional()
  @notNull()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string | null;

  @ApiPropertyOptional({ example: 'adarsh@example.com', nullable: true })
  @IsOptional()
  @notNull()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({
    enum: Gender,
    nullable: true,
    description: 'null resets to UNDISCLOSED',
  })
  @IsOptional()
  @notNull()
  @IsEnum(Gender)
  gender?: Gender | null;

  @ApiPropertyOptional({
    example: '1995-04-17',
    description: 'ISO date',
    nullable: true,
  })
  @IsOptional()
  @notNull()
  @IsDateString()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ example: 175.5, nullable: true })
  @IsOptional()
  @notNull()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(50)
  @Max(280)
  heightCm?: number | null;

  @ApiPropertyOptional({ example: 72.4, nullable: true })
  @IsOptional()
  @notNull()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(20)
  @Max(500)
  weightKg?: number | null;

  @ApiPropertyOptional({ example: 'Bengaluru', nullable: true })
  @IsOptional()
  @notNull()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @notNull()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;

  // --- Gym-level: answered during this gym's onboarding ---

  @ApiPropertyOptional({ enum: FitnessGoal, nullable: true })
  @IsOptional()
  @notNull()
  @IsEnum(FitnessGoal)
  goal?: FitnessGoal | null;

  @ApiPropertyOptional({ enum: ActivityLevel, nullable: true })
  @IsOptional()
  @notNull()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel | null;

  @ApiPropertyOptional({ example: 'Left knee surgery in 2023', nullable: true })
  @IsOptional()
  @notNull()
  @IsString()
  @MaxLength(1000)
  medicalNotes?: string | null;

  @ApiPropertyOptional({ example: 'Sunita Sharma', nullable: true })
  @IsOptional()
  @notNull()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string | null;

  @ApiPropertyOptional({ example: '+919812345678', nullable: true })
  @IsOptional()
  @notNull()
  @IsString()
  @MaxLength(20)
  emergencyContactPhone?: string | null;
}
