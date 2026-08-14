import { BadRequestException } from '@nestjs/common';
import { CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';

const DEFAULT_COUNTRY: CountryCode = 'IN';

/// Normalises any accepted input ("9876543210", "+91 98765 43210") to E.164.
export function toE164(
  input: string,
  country: CountryCode = DEFAULT_COUNTRY,
): string {
  const parsed = parsePhoneNumberFromString(input.trim(), country);
  if (!parsed?.isValid()) {
    throw new BadRequestException('Invalid phone number');
  }
  return parsed.number;
}

/// "+919876543210" -> "+91XXXXXX3210", for logs and API responses.
export function maskPhone(e164: string): string {
  if (e164.length <= 4) {
    return e164;
  }
  const visible = e164.slice(-4);
  const prefix = e164.slice(0, Math.min(3, e164.length - 4));
  return `${prefix}${'X'.repeat(e164.length - prefix.length - 4)}${visible}`;
}
