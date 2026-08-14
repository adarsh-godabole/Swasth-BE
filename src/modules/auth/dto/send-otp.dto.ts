import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Mobile number in E.164 or local Indian format',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  phone!: string;
}
