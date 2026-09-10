import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListWorkoutsDto {
  @ApiPropertyOptional({ default: 30, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 30;
}

export class WorkoutSummaryQueryDto {
  @ApiPropertyOptional({
    default: 30,
    maximum: 365,
    description: 'Window in gym-local days, counting back from today.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;
}
