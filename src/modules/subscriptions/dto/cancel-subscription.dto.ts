import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiPropertyOptional({ example: 'Upgraded to annual' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
