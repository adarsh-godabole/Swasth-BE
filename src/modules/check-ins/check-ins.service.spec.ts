import { currentStreak, longestStreak } from './check-ins.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const TODAY = d('2026-08-14');

describe('currentStreak', () => {
  it('is 0 with no visits', () => {
    expect(currentStreak([], TODAY)).toBe(0);
  });

  it('counts today plus the days before it', () => {
    expect(
      currentStreak([d('2026-08-14'), d('2026-08-13'), d('2026-08-12')], TODAY),
    ).toBe(3);
  });

  it('survives not having come in yet today', () => {
    // Came yesterday, has not been in this morning - the streak is intact
    // until a whole day is missed, otherwise it would read 0 every morning.
    expect(currentStreak([d('2026-08-13'), d('2026-08-12')], TODAY)).toBe(2);
  });

  it('breaks once a full day is missed', () => {
    expect(currentStreak([d('2026-08-12'), d('2026-08-11')], TODAY)).toBe(0);
  });

  it('stops at the gap rather than counting everything', () => {
    expect(
      currentStreak(
        [d('2026-08-14'), d('2026-08-13'), d('2026-08-10'), d('2026-08-09')],
        TODAY,
      ),
    ).toBe(2);
  });

  it('ignores duplicate days', () => {
    expect(
      currentStreak([d('2026-08-14'), d('2026-08-14'), d('2026-08-13')], TODAY),
    ).toBe(2);
  });

  it('handles a month boundary', () => {
    expect(
      currentStreak(
        [d('2026-08-01'), d('2026-07-31'), d('2026-07-30')],
        d('2026-08-01'),
      ),
    ).toBe(3);
  });
});

describe('longestStreak', () => {
  it('is 0 with no visits', () => {
    expect(longestStreak([])).toBe(0);
  });

  it('finds the best run, not the most recent', () => {
    const dates = [
      d('2026-08-01'),
      d('2026-08-02'),
      d('2026-08-03'),
      d('2026-08-04'),
      d('2026-08-10'),
      d('2026-08-11'),
    ];
    expect(longestStreak(dates)).toBe(4);
  });

  it('is 1 when no two days are consecutive', () => {
    expect(longestStreak([d('2026-08-01'), d('2026-08-05')])).toBe(1);
  });

  it('is unaffected by ordering', () => {
    expect(
      longestStreak([d('2026-08-03'), d('2026-08-01'), d('2026-08-02')]),
    ).toBe(3);
  });
});
