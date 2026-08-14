import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DurationUnit,
  GymRole,
  PaymentMethod,
  PaymentStatus,
  Subscription,
} from '@prisma/client';
import {
  computeEndDate,
  daysBetween,
  startOfDayUtc,
} from 'src/common/utils/date.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { PlansService, describeDuration } from '../plans/plans.service';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

export type SubscriptionStatus =
  'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'CANCELLED';

export interface SubscriptionView {
  id: string;
  memberId: string;
  planId: string | null;
  planName: string;
  durationLabel: string;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  /// Days left including today. 0 means it expires today; negative once past.
  daysRemaining: number;
  price: number;
  discount: number;
  amountDue: number;
  amountPaid: number;
  balance: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
}

/// What the member list and the app home screen show. Null when the member has
/// never bought anything.
export interface MembershipSummary {
  status: SubscriptionStatus;
  subscriptionId: string;
  planName: string;
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
  balance: number;
  /// Last day covered once queued renewals are counted. Differs from endDate
  /// when the member has already renewed for the next term.
  coveredUntil: Date;
  /// True when a later membership is already paid for and waiting.
  hasRenewalQueued: boolean;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  /// Sells a plan to a member.
  async create(
    gymId: string,
    memberId: string,
    dto: CreateSubscriptionDto,
    soldById?: string,
  ): Promise<SubscriptionView> {
    await this.getMemberOrThrow(gymId, memberId);
    const plan = await this.plans.getSellable(gymId, dto.planId);

    const startDate = dto.startDate
      ? startOfDayUtc(new Date(dto.startDate))
      : await this.defaultStartDate(memberId);

    const endDate = computeEndDate(
      startDate,
      plan.durationValue,
      plan.durationUnit,
    );

    await this.assertNoOverlap(memberId, startDate, endDate);

    const price = dto.price ?? Number(plan.price);
    const discount = dto.discount ?? 0;
    if (discount > price) {
      throw new BadRequestException('Discount cannot exceed the price');
    }

    const amountDue = round2(price - discount);
    const amountPaid = dto.amountPaid ?? amountDue;
    if (amountPaid > amountDue) {
      throw new BadRequestException(
        `Amount paid (${amountPaid}) is more than the amount due (${amountDue})`,
      );
    }

    const created = await this.prisma.subscription.create({
      data: {
        gymId,
        gymUserId: memberId,
        planId: plan.id,
        planName: plan.name,
        durationValue: plan.durationValue,
        durationUnit: plan.durationUnit,
        price,
        discount,
        amountPaid,
        paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
        paymentStatus: derivePaymentStatus(amountDue, amountPaid),
        startDate,
        endDate,
        notes: dto.notes,
        soldById: soldById ?? null,
      },
    });

    this.logger.log(
      `Sold "${plan.name}" to member ${memberId} (${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)})`,
    );
    return this.toView(created);
  }

  async listForMember(
    gymId: string,
    memberId: string,
  ): Promise<SubscriptionView[]> {
    await this.getMemberOrThrow(gymId, memberId);
    const rows = await this.prisma.subscription.findMany({
      where: { gymId, gymUserId: memberId },
      orderBy: { startDate: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async cancel(
    gymId: string,
    subscriptionId: string,
    dto: CancelSubscriptionDto,
  ): Promise<SubscriptionView> {
    const existing = await this.getOrThrow(gymId, subscriptionId);
    if (existing.cancelledAt) {
      throw new BadRequestException('This membership is already cancelled');
    }
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { cancelledAt: new Date(), cancelReason: dto.reason },
    });
    return this.toView(updated);
  }

  /// Adds cash to a part-paid membership.
  async recordPayment(
    gymId: string,
    subscriptionId: string,
    dto: RecordPaymentDto,
  ): Promise<SubscriptionView> {
    const existing = await this.getOrThrow(gymId, subscriptionId);

    const amountDue = round2(
      Number(existing.price) - Number(existing.discount),
    );
    const alreadyPaid = Number(existing.amountPaid);
    const balance = round2(amountDue - alreadyPaid);

    if (balance <= 0) {
      throw new BadRequestException('This membership is already paid in full');
    }
    if (dto.amount > balance) {
      throw new BadRequestException(
        `That is more than the outstanding balance of ${balance}`,
      );
    }

    const amountPaid = round2(alreadyPaid + dto.amount);
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        amountPaid,
        paymentMethod: dto.paymentMethod ?? existing.paymentMethod,
        paymentStatus: derivePaymentStatus(amountDue, amountPaid),
      },
    });
    return this.toView(updated);
  }

  /// Memberships ending within the next `days` days - the follow-up list.
  async expiring(gymId: string, days: number) {
    const today = startOfDayUtc();
    const cutoff = new Date(today.getTime() + days * 86_400_000);

    const rows = await this.prisma.subscription.findMany({
      where: {
        gymId,
        cancelledAt: null,
        startDate: { lte: today },
        endDate: { gte: today, lte: cutoff },
      },
      orderBy: { endDate: 'asc' },
      include: { gymUser: { include: { user: true } } },
    });

    return rows.map((row) => ({
      ...this.toView(row),
      member: {
        id: row.gymUser.id,
        memberCode: row.gymUser.memberCode,
        fullName: row.gymUser.user.fullName,
        phone: row.gymUser.user.phone,
      },
    }));
  }

  /// A renewal bought before the current membership runs out starts the day
  /// after it ends, so the member loses no time and there is no overlap.
  private async defaultStartDate(memberId: string): Promise<Date> {
    const today = startOfDayUtc();
    const latest = await this.prisma.subscription.findFirst({
      where: {
        gymUserId: memberId,
        cancelledAt: null,
        endDate: { gte: today },
      },
      orderBy: { endDate: 'desc' },
    });
    return latest
      ? new Date(startOfDayUtc(latest.endDate).getTime() + 86_400_000)
      : today;
  }

  private async assertNoOverlap(
    memberId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const clash = await this.prisma.subscription.findFirst({
      where: {
        gymUserId: memberId,
        cancelledAt: null,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      orderBy: { endDate: 'desc' },
    });

    if (clash) {
      throw new ConflictException(
        `This overlaps their "${clash.planName}" membership, which runs to ` +
          `${clash.endDate.toISOString().slice(0, 10)}. Cancel it first, or ` +
          `start the new one on ${new Date(clash.endDate.getTime() + 86_400_000).toISOString().slice(0, 10)}.`,
      );
    }
  }

  private async getMemberOrThrow(gymId: string, memberId: string) {
    const member = await this.prisma.gymUser.findFirst({
      where: { id: memberId, gymId, role: GymRole.MEMBER },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }

  private async getOrThrow(
    gymId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    const found = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, gymId },
    });
    if (!found) {
      throw new NotFoundException('Membership not found');
    }
    return found;
  }

  toView(subscription: Subscription): SubscriptionView {
    const today = startOfDayUtc();
    const amountDue = round2(
      Number(subscription.price) - Number(subscription.discount),
    );
    const amountPaid = Number(subscription.amountPaid);

    return {
      id: subscription.id,
      memberId: subscription.gymUserId,
      planId: subscription.planId,
      planName: subscription.planName,
      durationLabel: describeDuration(
        subscription.durationValue,
        subscription.durationUnit,
      ),
      status: deriveStatus(subscription, today),
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      daysRemaining: daysBetween(today, subscription.endDate),
      price: Number(subscription.price),
      discount: Number(subscription.discount),
      amountDue,
      amountPaid,
      balance: round2(amountDue - amountPaid),
      paymentMethod: subscription.paymentMethod,
      paymentStatus: subscription.paymentStatus,
      notes: subscription.notes,
      cancelledAt: subscription.cancelledAt,
      cancelReason: subscription.cancelReason,
      createdAt: subscription.createdAt,
    };
  }
}

/// Status is always computed, never stored - so an expired membership needs no
/// nightly job to notice it has expired.
export function deriveStatus(
  subscription: Pick<Subscription, 'cancelledAt' | 'startDate' | 'endDate'>,
  today: Date = startOfDayUtc(),
): SubscriptionStatus {
  if (subscription.cancelledAt) {
    return 'CANCELLED';
  }
  if (startOfDayUtc(subscription.startDate) > today) {
    return 'UPCOMING';
  }
  if (startOfDayUtc(subscription.endDate) < today) {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

/// Picks the membership to show on a member row, from the handful loaded with
/// them, and summarises it.
///
/// Selection order matters: the one covering today wins, so a member who has
/// already renewed still reads as ACTIVE on their current plan rather than
/// UPCOMING on next term's. Failing that, the soonest future one; failing that,
/// the most recent expired one.
export function summariseFor(
  subscriptions: Subscription[],
  today: Date = startOfDayUtc(),
): MembershipSummary | null {
  const live = subscriptions.filter((s) => !s.cancelledAt);
  if (live.length === 0) {
    return null;
  }

  const current =
    live.find((s) => deriveStatus(s, today) === 'ACTIVE') ??
    live
      .filter((s) => deriveStatus(s, today) === 'UPCOMING')
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] ??
    live.sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0];

  const coveredUntil = live.reduce(
    (furthest, s) => (s.endDate > furthest ? s.endDate : furthest),
    current.endDate,
  );

  const amountDue = round2(Number(current.price) - Number(current.discount));
  return {
    status: deriveStatus(current, today),
    subscriptionId: current.id,
    planName: current.planName,
    startDate: current.startDate,
    endDate: current.endDate,
    daysRemaining: daysBetween(today, current.endDate),
    balance: round2(amountDue - Number(current.amountPaid)),
    coveredUntil,
    hasRenewalQueued: coveredUntil > current.endDate,
  };
}

function derivePaymentStatus(
  amountDue: number,
  amountPaid: number,
): PaymentStatus {
  if (amountPaid >= amountDue) {
    return PaymentStatus.PAID;
  }
  return amountPaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING;
}

/// Money is Decimal in the database and plain numbers over the wire; rounding
/// here keeps 0.1 + 0.2 out of the response.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export { DurationUnit, round2 };
