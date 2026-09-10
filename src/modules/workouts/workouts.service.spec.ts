import { MuscleGroup } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { RequestGym } from 'src/common/types/authenticated-user.type';
import { durationMinutes, WorkoutsService } from './workouts.service';

const at = (iso: string) => new Date(iso);

describe('durationMinutes', () => {
  it('is null while the session is still open', () => {
    // No check-out endpoint exists, so an unfinished session has no length -
    // inventing one would be worse than showing nothing.
    expect(durationMinutes(at('2026-09-10T10:00:00Z'), null)).toBeNull();
  });

  it('rounds to the nearest minute', () => {
    expect(
      durationMinutes(at('2026-09-10T10:00:00Z'), at('2026-09-10T11:02:40Z')),
    ).toBe(63);
  });

  it('never goes negative if the clocks disagree', () => {
    expect(
      durationMinutes(at('2026-09-10T11:00:00Z'), at('2026-09-10T10:59:00Z')),
    ).toBe(0);
  });
});

describe('WorkoutsService.upsertToday', () => {
  const gym = {
    id: 'gym-1',
    code: 'SWK',
    timezone: 'Asia/Kolkata',
  } as RequestGym;

  const checkIn = {
    id: 'check-in-1',
    localDate: new Date('2026-09-10T00:00:00.000Z'),
    checkedInAt: at('2026-09-10T11:30:00Z'),
    workout: null as { endedAt: Date | null } | null,
  };

  const build = () => {
    const prisma = {
      checkIn: { findUnique: jest.fn().mockResolvedValue(checkIn) },
      workout: {
        upsert: jest.fn().mockImplementation(({ create }) => ({
          ...create,
          id: 'workout-1',
          gymUserId: create.gymUserId,
          updatedAt: at('2026-09-10T12:00:00Z'),
        })),
      },
    };
    return {
      prisma,
      service: new WorkoutsService(prisma as never),
    };
  };

  beforeEach(() => {
    checkIn.workout = null;
  });

  it('refuses a workout on a day with no visit', async () => {
    const { prisma, service } = build();
    prisma.checkIn.findUnique.mockResolvedValue(null);

    await expect(
      service.upsertToday(gym, 'member-1', { muscleGroups: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('starts the session at the check-in, not at the first tap', async () => {
    const { prisma, service } = build();

    await service.upsertToday(gym, 'member-1', {
      muscleGroups: [MuscleGroup.CHEST],
    });

    expect(prisma.workout.upsert.mock.calls[0][0].create.startedAt).toEqual(
      checkIn.checkedInAt,
    );
  });

  it('drops duplicate groups without widening the row', async () => {
    const { prisma, service } = build();

    await service.upsertToday(gym, 'member-1', {
      muscleGroups: [MuscleGroup.CHEST, MuscleGroup.CHEST, MuscleGroup.ABS],
    });

    expect(prisma.workout.upsert.mock.calls[0][0].update.muscleGroups).toEqual([
      MuscleGroup.CHEST,
      MuscleGroup.ABS,
    ]);
  });

  it('leaves a finished session finished when the flag is omitted', async () => {
    // Every tap of the body map calls this. If an omitted flag cleared the end
    // time, editing the muscles after finishing would silently restart the clock.
    const ended = at('2026-09-10T12:30:00Z');
    checkIn.workout = { endedAt: ended };
    const { prisma, service } = build();

    await service.upsertToday(gym, 'member-1', {
      muscleGroups: [MuscleGroup.ABS],
    });

    expect(prisma.workout.upsert.mock.calls[0][0].update.endedAt).toEqual(
      ended,
    );
  });

  it('keeps the original end time rather than re-stamping it', async () => {
    const ended = at('2026-09-10T12:30:00Z');
    checkIn.workout = { endedAt: ended };
    const { prisma, service } = build();

    await service.upsertToday(gym, 'member-1', {
      muscleGroups: [],
      finished: true,
    });

    expect(prisma.workout.upsert.mock.calls[0][0].update.endedAt).toEqual(
      ended,
    );
  });

  it('reopens a session when finished is false', async () => {
    checkIn.workout = { endedAt: at('2026-09-10T12:30:00Z') };
    const { prisma, service } = build();

    await service.upsertToday(gym, 'member-1', {
      muscleGroups: [],
      finished: false,
    });

    expect(prisma.workout.upsert.mock.calls[0][0].update.endedAt).toBeNull();
  });
});
