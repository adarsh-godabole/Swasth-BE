import { DurationUnit } from '@prisma/client';

const MS_PER_DAY = 86_400_000;

/// Membership dates are calendar days, not instants - they are stored as
/// Postgres DATE and compared against "today". Everything here works at UTC
/// midnight so a server in one timezone and a gym in another agree on the day.
export function startOfDayUtc(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(startOfDayUtc(date).getTime() + days * MS_PER_DAY);
}

/// Calendar-month arithmetic, clamped to the end of short months so
/// 31 January + 1 month is 28 February rather than JavaScript's 3 March.
export function addMonthsUtc(date: Date, months: number): Date {
  const from = startOfDayUtc(date);
  const firstOfTarget = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1),
  );
  const daysInTarget = new Date(
    Date.UTC(
      firstOfTarget.getUTCFullYear(),
      firstOfTarget.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(from.getUTCDate(), daysInTarget));
  return firstOfTarget;
}

/// Last day the membership is valid, inclusive.
///
/// A 3-month plan starting 15 Jan runs to 14 Apr, so the renewal can start on
/// 15 Apr with no gap and no overlap. A 1-day pass starts and ends the same day.
export function computeEndDate(
  startDate: Date,
  durationValue: number,
  durationUnit: DurationUnit,
): Date {
  const start = startOfDayUtc(startDate);
  return durationUnit === DurationUnit.MONTH
    ? addDaysUtc(addMonthsUtc(start, durationValue), -1)
    : addDaysUtc(start, durationValue - 1);
}

/// Whole days from `from` until `to`, inclusive of neither end. Expiring today
/// gives 0.
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDayUtc(to).getTime() - startOfDayUtc(from).getTime()) / MS_PER_DAY,
  );
}
