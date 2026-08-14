import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGymDto {
  @ApiProperty({
    example: 'swasth-koramangala',
    description:
      'Stable slug the gym app is built against. Lowercase letters, numbers and hyphens.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'code must be lowercase words separated by hyphens',
  })
  code!: string;

  @ApiProperty({ example: 'Swasth Fitness, Koramangala' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Swasth Fitness Pvt Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @ApiProperty({ example: '+918012345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: 'hello@swasthfitness.in' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '80 Feet Road, 6th Block' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Karnataka' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: '560095' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  pincode?: string;

  @ApiPropertyOptional({
    example: 'SWK-',
    description: 'Prefix for member codes, e.g. SWK- gives SWK-0001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  memberCodePrefix?: string;

  @ApiProperty({
    example: '+919876543210',
    description: "Mobile number of the gym owner. They're created as OWNER.",
  })
  @IsString()
  @IsNotEmpty()
  ownerPhone!: string;

  @ApiPropertyOptional({ example: 'Ramesh Kumar' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string;
}
