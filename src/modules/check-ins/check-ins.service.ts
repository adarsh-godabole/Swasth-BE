import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CheckIn,
  CheckInSource,
  GymRole,
  GymUser,
  Prisma,
  Subscription,
  User,
} from '@prisma/client';
import { RequestGym } from 'src/common/types/authenticated-user.type';
import {
  addDaysUtc,
  daysBetween,
  gymLocalDate,
} from 'src/common/utils/date.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { deriveStatus } from '../subscriptions/subscriptions.service';

export interface CheckInView {
  id: string;
  memberId: string;
  date: Date;
  checkedInAt: Date;
  source: CheckInSource;
  /// True when they had already checked in today and this call changed nothing.
  alreadyCheckedIn: boolean;
}

export interface CheckInSummary {
  checkedInToday: boolean;
  checkedInAt: Date | null;
  /// Consecutive days ending today (or yesterday, if today is still to come).
  currentStreak: number;
  longestStreak: number;
  visitsThisMonth: number;
  totalVisits: number;
  lastVisitAt: Date | null;
}

const HISTORY_WINDOW_DAYS = 400;

@Injectable()
export class CheckInsService {
  private readonly logger = new Logger(CheckInsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /// Records a visit. The member taps a button and confirms in the app - there
  /// is no scanner - so this is self-reported by design.
  ///
  /// Checking in twice on the same day is **not** an error: the second call
  /// returns the first check-in with alreadyCheckedIn set. A double tap on a
  /// slow connection is far more likely than a genuine second visit, and
  /// failing it would look broken to the member for no benefit.
  async checkIn(
    gym: RequestGym,
    memberId: string,
    source: CheckInSource,
    recordedById?: string,
  ): Promise<CheckInView> {
    const member = await this.getMemberOrThrow(gym.id, memberId);
    const activeSubscription = this.activeSubscription(member.subscriptions);

    if (!activeSubscription) {
      throw new ForbiddenException(
        member.subscriptions.length
          ? 'Your membership has expired. Please renew at the gym.'
          : 'You need an active membership to check in. Please visit the gym to join.',
      );
    }

    const today = gymLocalDate(gym.timezone);

    const existing = await this.prisma.checkIn.findUnique({
      where: { gymUserId_localDate: { gymUserId: memberId, localDate: today } },
    });
    if (existing) {
      return this.toView(existing, true);
    }

    try {
      const [created] = await this.prisma.$transaction([
        this.prisma.checkIn.create({
          data: {
            gymId: gym.id,
            gymUserId: memberId,
            subscriptionId: activeSubscription.id,
            localDate: today,
            source,
            recordedById: recordedById ?? null,
          },
        }),
        this.prisma.gymUser.update({
          where: { id: memberId },
          data: { lastVisitAt: new Date() },
        }),
      ]);

      this.logger.log(`Check-in for member ${memberId} at ${gym.code}`);
      return this.toView(created, false);
    } catch (error) {
      // Two taps landing at once both miss the read above; the unique index
      // catches the loser, and returning the winner is the friendly outcome.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.checkIn.findUniqueOrThrow({
          where: {
            gymUserId_localDate: { gymUserId: memberId, localDate: today },
          },
        });
        return this.toView(winner, true);
      }
      throw error;
    }
  }

  /// Streaks and counts for the app home screen.
  async summary(gym: RequestGym, memberId: string): Promise<CheckInSummary> {
    const today = gymLocalDate(gym.timezone);
    const since = addDaysUtc(today, -HISTORY_WINDOW_DAYS);

    const rows = await this.prisma.checkIn.findMany({
      where: { gymUserId: memberId, localDate: { gte: since } },
      orderBy: { localDate: 'desc' },
      select: { localDate: true, checkedInAt: true },
    });

    const total = await this.prisma.checkIn.count({
      where: { gymUserId: memberId },
    });

    const todayRow = rows.find(
      (row) => row.localDate.getTime() === today.getTime(),
    );

    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );

    return {
      checkedInToday: Boolean(todayRow),
      checkedInAt: todayRow?.checkedInAt ?? null,
      currentStreak: currentStreak(
        rows.map((row) => row.localDate),
        today,
      ),
      longestStreak: longestStreak(rows.map((row) => row.localDate)),
      visitsThisMonth: rows.filter((row) => row.localDate >= monthStart).length,
      totalVisits: total,
      lastVisitAt: rows[0]?.checkedInAt ?? null,
    };
  }

  /// A member's own visit history, most recent first.
  async history(
    gymId: string,
    memberId: string,
    limit: number,
  ): Promise<CheckInView[]> {
    const rows = await this.prisma.checkIn.findMany({
      where: { gymId, gymUserId: memberId },
      orderBy: { localDate: 'desc' },
      take: limit,
    });
    return rows.map((row) => this.toView(row, false));
  }

  /// Who came in on a given day - the front desk's attendance register.
  async listForDay(gym: RequestGym, date?: string) {
    const day = date
      ? new Date(`${date}T00:00:00.000Z`)
      : gymLocalDate(gym.timezone);

    const rows = await this.prisma.checkIn.findMany({
      where: { gymId: gym.id, localDate: day },
      orderBy: { checkedInAt: 'desc' },
      include: { gymUser: { include: { user: true } } },
    });

    return {
      date: day,
      total: rows.length,
      items: rows.map((row) => ({
        ...this.toView(row, false),
        member: {
          id: row.gymUser.id,
          memberCode: row.gymUser.memberCode,
          fullName: row.gymUser.user.fullName,
          phone: row.gymUser.user.phone,
        },
      })),
    };
  }

  private activeSubscription(
    subscriptions: Subscription[],
  ): Subscription | undefined {
    return subscriptions.find(
      (subscription) => deriveStatus(subscription) === 'ACTIVE',
    );
  }

  private async getMemberOrThrow(
    gymId: string,
    memberId: string,
  ): Promise<GymUser & { user: User; subscriptions: Subscription[] }> {
    const member = await this.prisma.gymUser.findFirst({
      where: { id: memberId, gymId, role: GymRole.MEMBER },
      include: {
        user: true,
        subscriptions: { where: { cancelledAt: null } },
      },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }

  private toView(checkIn: CheckIn, alreadyCheckedIn: boolean): CheckInView {
    return {
      id: checkIn.id,
      memberId: checkIn.gymUserId,
      date: checkIn.localDate,
      checkedInAt: checkIn.checkedInAt,
      source: checkIn.source,
      alreadyCheckedIn,
    };
  }
}

/// Consecutive days up to today. A streak survives "not yet today" - someone
/// who came yesterday and has not been in yet this morning still has their
/// streak; it only breaks once a whole day is missed.
export function currentStreak(dates: Date[], today: Date): number {
  if (dates.length === 0) {
    return 0;
  }

  const days = new Set(dates.map((date) => date.getTime()));
  const gapToLatest = daysBetween(new Date(Math.max(...days)), today);
  if (gapToLatest > 1) {
    return 0;
  }

  let streak = 0;
  let cursor = days.has(today.getTime()) ? today : addDaysUtc(today, -1);
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor = addDaysUtc(cursor, -1);
  }
  return streak;
}

export function longestStreak(dates: Date[]): number {
  if (dates.length === 0) {
    return 0;
  }
  const sorted = [...new Set(dates.map((date) => date.getTime()))].sort(
    (a, b) => a - b,
  );

  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const consecutive = daysBetween(
      new Date(sorted[i - 1]),
      new Date(sorted[i]),
    );
    run = consecutive === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}
