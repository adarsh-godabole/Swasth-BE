import { DurationUnit } from '@prisma/client';
import {
  addMonthsUtc,
  computeEndDate,
  daysBetween,
  startOfDayUtc,
} from './date.util';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe('date.util', () => {
  describe('addMonthsUtc', () => {
    it('keeps the day of the month', () => {
      expect(iso(addMonthsUtc(d('2026-01-15'), 3))).toBe('2026-04-15');
    });

    it('clamps to the end of a shorter month', () => {
      // Plain setUTCMonth would roll over to 3 March here.
      expect(iso(addMonthsUtc(d('2026-01-31'), 1))).toBe('2026-02-28');
    });

    it('handles a leap year', () => {
      expect(iso(addMonthsUtc(d('2028-01-31'), 1))).toBe('2028-02-29');
    });

    it('crosses a year boundary', () => {
      expect(iso(addMonthsUtc(d('2026-11-20'), 3))).toBe('2027-02-20');
    });
  });

  describe('computeEndDate', () => {
    it('ends a 3-month plan the day before the same date', () => {
      // 15 Jan to 14 Apr, so a renewal can start 15 Apr with no gap.
      expect(iso(computeEndDate(d('2026-01-15'), 3, DurationUnit.MONTH))).toBe(
        '2026-04-14',
      );
    });

    it('starts and ends a day pass on the same day', () => {
      expect(iso(computeEndDate(d('2026-08-14'), 1, DurationUnit.DAY))).toBe(
        '2026-08-14',
      );
    });

    it('counts a 10-day pass inclusively', () => {
      expect(iso(computeEndDate(d('2026-08-14'), 10, DurationUnit.DAY))).toBe(
        '2026-08-23',
      );
    });

    it('handles a 12-month plan from a month end', () => {
      expect(iso(computeEndDate(d('2026-02-28'), 12, DurationUnit.MONTH))).toBe(
        '2027-02-27',
      );
    });
  });

  describe('daysBetween', () => {
    it('is 0 on the last valid day', () => {
      expect(daysBetween(d('2026-08-14'), d('2026-08-14'))).toBe(0);
    });

    it('counts forward', () => {
      expect(daysBetween(d('2026-08-14'), d('2026-08-21'))).toBe(7);
    });

    it('goes negative once expired', () => {
      expect(daysBetween(d('2026-08-14'), d('2026-08-11'))).toBe(-3);
    });

    it('is unaffected by the time of day', () => {
      expect(
        daysBetween(new Date('2026-08-14T23:59:00Z'), d('2026-08-15')),
      ).toBe(1);
    });
  });

  it('startOfDayUtc strips the time', () => {
    expect(startOfDayUtc(new Date('2026-08-14T18:45:12Z')).toISOString()).toBe(
      '2026-08-14T00:00:00.000Z',
    );
  });
});
