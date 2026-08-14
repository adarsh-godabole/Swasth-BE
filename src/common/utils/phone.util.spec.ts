import { BadRequestException } from '@nestjs/common';
import { maskPhone, toE164 } from './phone.util';

describe('phone.util', () => {
  describe('toE164', () => {
    it('normalises a bare Indian mobile number', () => {
      expect(toE164('9876543210')).toBe('+919876543210');
    });

    it('normalises a spaced international number', () => {
      expect(toE164('+91 98765 43210')).toBe('+919876543210');
    });

    it('rejects an invalid number', () => {
      expect(() => toE164('12345')).toThrow(BadRequestException);
    });
  });

  describe('maskPhone', () => {
    it('keeps the country prefix and last four digits', () => {
      expect(maskPhone('+919876543210')).toBe('+91XXXXXX3210');
    });

    it('leaves very short values untouched', () => {
      expect(maskPhone('1234')).toBe('1234');
    });
  });
});
