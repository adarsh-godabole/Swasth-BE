import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MuscleGroup } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
} from 'class-validator';

export class UpsertWorkoutDto {
  /// The whole selection, not a delta: the member is looking at a body map with
  /// everything they picked still highlighted, so replacing the set is what the
  /// screen actually means. Un-tapping a muscle is a shorter array.
  @ApiProperty({
    enum: MuscleGroup,
    isArray: true,
    example: [MuscleGroup.CHEST, MuscleGroup.BICEPS],
    description:
      'The complete set of areas trained today. Replaces what was there; send [] to clear. Duplicates are ignored.',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(MuscleGroup, { each: true })
  muscleGroups!: MuscleGroup[];

  @ApiPropertyOptional({
    description:
      'true stamps the end of the session (server clock), false reopens it. Omit to leave it as it is.',
  })
  @IsOptional()
  @IsBoolean()
  finished?: boolean;
}
