import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

/// Records more cash against a subscription that was only part-paid. There is
/// no payment gateway - this is the front desk writing down what came in.
export class RecordPaymentDto {
  @ApiProperty({ example: 500, description: 'Additional amount collected now' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  amount!: number;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
