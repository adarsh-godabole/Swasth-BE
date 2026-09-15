import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CheckInByCodeDto {
  @ApiProperty({
    example: 'K7M29QX4',
    description:
      "The gym's door code, as carried by the QR deep link or typed off the poster. Case and dashes are normalised server-side.",
  })
  @IsString()
  @IsNotEmpty()
  // Generous next to the 8 real characters: the member may paste it with
  // spacing or dashes, which is normalised rather than rejected.
  @MaxLength(32)
  code!: string;
}
