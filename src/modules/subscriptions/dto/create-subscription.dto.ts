import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Plan being sold' })
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({
    example: '2026-08-15',
    description:
      'Defaults to today, or the day after the current membership ends if they are renewing early',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: 4500,
    description: "Overrides the plan's list price for this sale only",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  price?: number;

  @ApiPropertyOptional({ example: 500, description: 'Discount in rupees' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  discount?: number;

  @ApiPropertyOptional({
    example: 4000,
    description: 'Cash actually collected. Defaults to the full amount due.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  amountPaid?: number;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 'Paid half now, rest on the 20th' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
