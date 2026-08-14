import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsNumberString({ no_symbols: true })
  @Length(4, 8)
  code!: string;

  @ApiPropertyOptional({
    enum: DevicePlatform,
    example: DevicePlatform.ANDROID,
  })
  @IsOptional()
  @IsEnum(DevicePlatform)
  platform?: DevicePlatform;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  appVersion?: string;

  @ApiPropertyOptional({ description: 'FCM / APNs push token' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pushToken?: string;
}
