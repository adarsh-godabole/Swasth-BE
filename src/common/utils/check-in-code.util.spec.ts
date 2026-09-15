import {
  CHECK_IN_CODE_LENGTH,
  generateCheckInCode,
  normaliseCheckInCode,
} from './check-in-code.util';

describe('generateCheckInCode', () => {
  it('is eight characters', () => {
    expect(generateCheckInCode()).toHaveLength(CHECK_IN_CODE_LENGTH);
  });

  it('never emits a character that reads as another', () => {
    // I/L/O/U are excluded so nothing is mistaken for 1, 0 or each other when
    // a member types the code off a poster.
    for (let i = 0; i < 200; i += 1) {
      expect(generateCheckInCode()).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
    }
  });

  it('does not repeat itself in any practical run', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(generateCheckInCode());
    expect(seen.size).toBe(500);
  });

  it('round-trips through the parser', () => {
    const code = generateCheckInCode();
    expect(normaliseCheckInCode(code)).toBe(code);
  });
});

describe('normaliseCheckInCode', () => {
  it('accepts the code as printed', () => {
    expect(normaliseCheckInCode('K7M29QX4')).toBe('K7M29QX4');
  });

  it('accepts what a member actually types', () => {
    // Lower case, the dash they copied off the poster, and the spaces a phone
    // keyboard adds are all the same code.
    expect(normaliseCheckInCode('k7m29qx4')).toBe('K7M29QX4');
    expect(normaliseCheckInCode('K7M2-9QX4')).toBe('K7M29QX4');
    expect(normaliseCheckInCode('  K7M2 9QX4 ')).toBe('K7M29QX4');
  });

  it('rejects the wrong length', () => {
    expect(normaliseCheckInCode('K7M29QX')).toBeNull();
    expect(normaliseCheckInCode('K7M29QX45')).toBeNull();
    expect(normaliseCheckInCode('')).toBeNull();
  });

  it('rejects characters that are not in the alphabet', () => {
    // A member reading "0" as "O" should be told the code is wrong, not have
    // it silently resolve to a different gym's code.
    expect(normaliseCheckInCode('K7M29QXO')).toBeNull();
    expect(normaliseCheckInCode('K7M29QXI')).toBeNull();
    expect(normaliseCheckInCode('K7M29QX!')).toBeNull();
  });
});
