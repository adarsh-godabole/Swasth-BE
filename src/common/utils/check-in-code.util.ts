import { randomInt } from 'node:crypto';

/// Crockford base32 minus I, L, O and U: nothing in here can be misread as 1,
/// 0 or each other. The code is printed on a poster and typed by hand when a
/// camera will not cooperate, so ambiguity is a real support cost.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const CHECK_IN_CODE_LENGTH = 8;

/// A fresh door code. 32^8 is ~1.1 trillion, and the only thing guessing one
/// buys you is the ability to mark yourself present at a gym you are already a
/// member of, so this is sized against collisions rather than attackers.
export function generateCheckInCode(): string {
  let code = '';
  for (let i = 0; i < CHECK_IN_CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/// Accepts what a member actually types: lower case, and the spacing or dashes
/// they copy off the poster. Returns null when the result could not be a code,
/// so callers can reject without a database round trip.
export function normaliseCheckInCode(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[\s-]/g, '');
  if (cleaned.length !== CHECK_IN_CODE_LENGTH) return null;
  for (const character of cleaned) {
    if (!ALPHABET.includes(character)) return null;
  }
  return cleaned;
}
