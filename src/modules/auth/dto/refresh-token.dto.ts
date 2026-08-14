import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token issued at login' })
  @IsJWT()
  @IsNotEmpty()
  refreshToken!: string;
}
