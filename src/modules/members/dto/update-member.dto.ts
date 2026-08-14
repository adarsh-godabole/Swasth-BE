import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateMemberDto } from './create-member.dto';

/// Everything a member can have changed by staff except the phone number, which
/// is their login identity and needs OTP re-verification to move.
export class UpdateMemberDto extends PartialType(
  OmitType(CreateMemberDto, ['phone'] as const),
) {}
