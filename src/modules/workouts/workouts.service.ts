import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { MuscleGroup, Workout } from '@prisma/client';
import { RequestGym } from 'src/common/types/authenticated-user.type';
import { addDaysUtc, gymLocalDate } from 'src/common/utils/date.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpsertWorkoutDto } from './dto/upsert-workout.dto';

export interface WorkoutView {
  id: string;
  memberId: string;
  checkInId: string;
  /// The gym's local day. Render it as a plain date, never through a timezone.
  date: Date;
  muscleGroups: MuscleGroup[];
  startedAt: Date;
  endedAt: Date | null;
  /// null while the session is still open - there is no check-out to infer one from.
  durationMinutes: number | null;
  updatedAt: Date;
}

export interface MuscleGroupTally {
  muscleGroup: MuscleGroup;
  /// Days the area was trained, not sets or reps - a day is the unit here.
  days: number;
}

export interface WorkoutSummary {
  days: number;
  from: Date;
  to: Date;
  sessionsLogged: number;
  minutesTrained: number;
  /// Busiest first. Areas never trained in the window are absent, which is
  /// exactly the gap a member wants to see.
  muscleGroups: MuscleGroupTally[];
}

@Injectable()
export class WorkoutsService {
  private readonly logger = new Logger(WorkoutsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /// Records what the member is training today, against today's check-in.
  ///
  /// Idempotent by design: the app writes on every tap of the body map, so this
  /// is called many times a session and must converge rather than accumulate.
  async upsertToday(
    gym: RequestGym,
    memberId: string,
    dto: UpsertWorkoutDto,
  ): Promise<WorkoutView> {
    const today = gymLocalDate(gym.timezone);

    const checkIn = await this.prisma.checkIn.findUnique({
      where: { gymUserId_localDate: { gymUserId: memberId, localDate: today } },
      include: { workout: true },
    });

    // A workout hangs off a visit. Without one there is no day to attach it to,
    // and letting it through would let a member log training from their sofa.
    if (!checkIn) {
      throw new ConflictException(
        "Check in first, then log what you're training.",
      );
    }

    const muscleGroups = dedupe(dto.muscleGroups);
    const endedAt = this.resolveEndedAt(
      checkIn.workout?.endedAt ?? null,
      dto.finished,
    );

    const workout = await this.prisma.workout.upsert({
      where: { checkInId: checkIn.id },
      create: {
        gymId: gym.id,
        gymUserId: memberId,
        checkInId: checkIn.id,
        localDate: checkIn.localDate,
        // The clock the member sees has been running since they checked in, so
        // the session starts there and not at the first tap on the body map.
        startedAt: checkIn.checkedInAt,
        muscleGroups,
        endedAt,
      },
      update: { muscleGroups, endedAt },
    });

    this.logger.log(
      `Workout for member ${memberId} at ${gym.code}: ${muscleGroups.join(', ') || 'nothing logged'}`,
    );
    return toView(workout);
  }

  /// Most recent day first, matching the visit history.
  async history(
    gymId: string,
    memberId: string,
    limit: number,
  ): Promise<WorkoutView[]> {
    const rows = await this.prisma.workout.findMany({
      where: { gymId, gymUserId: memberId },
      orderBy: { localDate: 'desc' },
      take: limit,
    });
    return rows.map(toView);
  }

  /// What the last few weeks add up to. The list of days says what was done;
  /// this says what keeps being skipped, which is the part worth reading.
  async summary(
    gym: RequestGym,
    memberId: string,
    days: number,
  ): Promise<WorkoutSummary> {
    const today = gymLocalDate(gym.timezone);
    const from = addDaysUtc(today, -(days - 1));

    const rows = await this.prisma.workout.findMany({
      where: { gymUserId: memberId, localDate: { gte: from, lte: today } },
      select: {
        muscleGroups: true,
        startedAt: true,
        endedAt: true,
      },
    });

    const tally = new Map<MuscleGroup, number>();
    let minutes = 0;

    for (const row of rows) {
      // A row is already one gym day, so each group counts once per row.
      for (const group of new Set(row.muscleGroups)) {
        tally.set(group, (tally.get(group) ?? 0) + 1);
      }
      minutes += durationMinutes(row.startedAt, row.endedAt) ?? 0;
    }

    return {
      days,
      from,
      to: today,
      sessionsLogged: rows.length,
      minutesTrained: minutes,
      muscleGroups: [...tally.entries()]
        .map(([muscleGroup, count]) => ({ muscleGroup, days: count }))
        .sort(
          (a, b) =>
            b.days - a.days || a.muscleGroup.localeCompare(b.muscleGroup),
        ),
    };
  }

  /// `finished` is a three-state flag: stamp it, clear it, or leave it alone.
  /// The end time is the server's, never the client's - a wrong phone clock
  /// would otherwise produce a negative session.
  private resolveEndedAt(
    current: Date | null,
    finished: boolean | undefined,
  ): Date | null {
    if (finished === undefined) return current;
    if (finished === false) return null;
    return current ?? new Date();
  }
}

/// Order is the order the member tapped, which is worth keeping; duplicates are
/// not, and a client that double-fires a tap should not widen the row.
function dedupe(groups: MuscleGroup[]): MuscleGroup[] {
  return [...new Set(groups)];
}

export function durationMinutes(
  startedAt: Date,
  endedAt: Date | null,
): number | null {
  if (!endedAt) return null;
  const ms = endedAt.getTime() - startedAt.getTime();
  // A clock adjustment between the two stamps should read as zero, not as a
  // negative session.
  return Math.max(0, Math.round(ms / 60_000));
}

function toView(workout: Workout): WorkoutView {
  return {
    id: workout.id,
    memberId: workout.gymUserId,
    checkInId: workout.checkInId,
    date: workout.localDate,
    muscleGroups: workout.muscleGroups,
    startedAt: workout.startedAt,
    endedAt: workout.endedAt,
    durationMinutes: durationMinutes(workout.startedAt, workout.endedAt),
    updatedAt: workout.updatedAt,
  };
}
