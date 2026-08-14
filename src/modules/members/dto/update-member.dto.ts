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

/// Everything a member can have changed by staff except the phone number, which
/// is their login identity and needs OTP re-verification to move.
///
/// Every field follows PATCH semantics: omit it to leave it alone, or send
/// `null` to clear it. Written out in full rather than derived from
/// CreateMemberDto because the nullability differs - create cannot accept a
/// null where update uses one to mean "clear this".
///
/// `@ValidateIf(v !== null)` is what lets a null through to the service while
/// still validating real values. Note that @IsOptional() alone would also let
/// null past, silently - being explicit here keeps that visible.
const notNull = () => ValidateIf((_object, value) => value !== null);

export class UpdateMemberDto {
  @ApiPropertyOptional({
    example: 'Rohit Sharma',
    nullable: true,
    description: 'Send null to clear',
  })
  @IsOptional()
  @notNull()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string | null;

  @ApiPropertyOptional({ example: 'rohit@example.com', nullable: true })
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

  @ApiPropertyOptional({ example: '1995-04-17', nullable: true })
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

  @ApiPropertyOptional({ example: 82.4, nullable: true })
  @IsOptional()
  @notNull()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(20)
  @Max(500)
  weightKg?: number | null;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @notNull()
  @IsString()
  @MaxLength(1000)
  medicalNotes?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @notNull()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

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
