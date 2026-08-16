import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Gender,
  GymRole,
  GymUser,
  GymUserStatus,
  MemberSource,
  Prisma,
  Subscription,
  User,
} from '@prisma/client';
import { startOfDayUtc } from 'src/common/utils/date.util';
import { patchField } from 'src/common/utils/patch.util';
import { toE164 } from 'src/common/utils/phone.util';
import {
  MembershipSummary,
  summariseFor,
} from '../subscriptions/subscriptions.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokensService } from '../auth/tokens.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { DeactivateMemberDto } from './dto/deactivate-member.dto';
import { ListMembersDto } from './dto/list-members.dto';
import { MemberStatsDto } from './dto/member-stats.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

type GymUserWithUser = GymUser & {
  user: User;
  /// The most recent few non-cancelled memberships.
  subscriptions?: Subscription[];
};

/// Loads the memberships the member list needs to describe someone's standing.
const CURRENT_SUBSCRIPTION = {
  where: { cancelledAt: null },
  orderBy: { endDate: 'desc' },
  // A few, not one: summariseFor picks the membership covering today, which is
  // not necessarily the one ending furthest out once a renewal is queued.
  take: 5,
} satisfies Prisma.GymUser$subscriptionsArgs;

export interface MemberView {
  id: string;
  userId: string;
  memberCode: string | null;
  fullName: string | null;
  phone: string;
  email: string | null;
  gender: User['gender'];
  dateOfBirth: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: GymUser['goal'];
  activityLevel: GymUser['activityLevel'];
  medicalNotes: string | null;
  notes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  status: GymUserStatus;
  source: MemberSource;
  hasAppAccount: boolean;
  onboarded: boolean;
  joinedAt: Date;
  lastVisitAt: Date | null;
  /// Their current membership, or null if they have never bought one.
  membership: MembershipSummary | null;
}

export interface PaginatedMembers {
  items: MemberView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MemberStats {
  totalMembers: number;
  expiringInDays: number;
  /// Everyone with a live membership, including those expiring soon. This is
  /// the "active members" number - do not add it to buckets.expiringSoon.
  activeTotal: number;
  /// Mutually exclusive; sums exactly to totalMembers.
  buckets: {
    /// Active and not expiring within expiringInDays.
    active: number;
    expiringSoon: number;
    /// Has membership history but nothing live - lapsed or cancelled.
    expired: number;
    /// Never bought anything. Usually app signups.
    never: number;
  };
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
  ) {}

  /// Registers a walk-in at the front desk.
  ///
  /// The person may already exist system-wide (they're a member at another gym,
  /// or they installed the app first). In that case we reuse the person and
  /// only add the link to this gym.
  async create(gymId: string, dto: CreateMemberDto): Promise<MemberView> {
    const phone = toE164(dto.phone);

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
      include: { gymUsers: { where: { gymId } } },
    });

    if (existingUser?.deletedAt) {
      throw new ConflictException(
        'This number belonged to a deleted account. Ask them to sign up in the app first.',
      );
    }

    const link = existingUser?.gymUsers[0];
    if (link) {
      if (link.role !== GymRole.MEMBER) {
        throw new ConflictException(
          `This number is already registered here as ${link.role.replace('_', ' ').toLowerCase()}`,
        );
      }
      if (link.status === GymUserStatus.ACTIVE) {
        throw new ConflictException(
          `${existingUser?.fullName ?? 'This person'} is already a member${
            link.memberCode ? ` (${link.memberCode})` : ''
          }`,
        );
      }
      // Somebody who left and came back keeps their original member code and
      // history rather than being registered afresh.
      return this.reactivateExisting(link.id, dto);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: this.fillBlanksOnly(existingUser, dto),
          })
        : await tx.user.create({
            data: {
              phone,
              fullName: dto.fullName.trim(),
              email: dto.email?.toLowerCase(),
              // A null would violate the non-nullable column; let the default
              // (UNDISCLOSED) apply instead.
              gender: dto.gender ?? undefined,
              dateOfBirth: dto.dateOfBirth
                ? new Date(dto.dateOfBirth)
                : undefined,
              heightCm: dto.heightCm,
              weightKg: dto.weightKg,
            },
          });

      // Atomic per-gym counter: the increment and the read are the same
      // statement, so two desks registering at once can't collide.
      const gym = await tx.gym.update({
        where: { id: gymId },
        data: { memberSeq: { increment: 1 } },
        select: { memberCodePrefix: true, memberSeq: true },
      });
      const memberCode = `${gym.memberCodePrefix}${String(gym.memberSeq).padStart(4, '0')}`;

      return tx.gymUser.create({
        data: {
          gymId,
          userId: user.id,
          role: GymRole.MEMBER,
          status: GymUserStatus.ACTIVE,
          source: MemberSource.FRONT_DESK,
          memberCode,
          goal: dto.goal,
          activityLevel: dto.activityLevel,
          medicalNotes: dto.medicalNotes,
          notes: dto.notes,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone
            ? toE164(dto.emergencyContactPhone)
            : undefined,
        },
        include: { user: true, subscriptions: CURRENT_SUBSCRIPTION },
      });
    });

    this.logger.log(`Member ${created.memberCode} registered at gym ${gymId}`);
    return this.toView(created);
  }

  async list(gymId: string, query: ListMembersDto): Promise<PaginatedMembers> {
    const {
      search,
      status,
      source,
      membershipStatus,
      expiringInDays,
      page,
      limit,
      sortBy,
      sortOrder,
    } = query;

    const where: Prisma.GymUserWhereInput = {
      gymId,
      role: GymRole.MEMBER,
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...this.membershipFilter(membershipStatus, expiringInDays),
      ...(search
        ? {
            OR: [
              {
                user: {
                  fullName: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
              { user: { phone: { contains: search } } },
              {
                memberCode: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.GymUserOrderByWithRelationInput =
      sortBy === 'fullName'
        ? { user: { fullName: sortOrder } }
        : { [sortBy]: sortOrder };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.gymUser.findMany({
        where,
        include: { user: true, subscriptions: CURRENT_SUBSCRIPTION },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.gymUser.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toView(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /// Membership state is derived from subscription dates rather than stored, so
  /// filtering by it means querying the related rows instead of a column.
  private membershipFilter(
    membershipStatus: ListMembersDto['membershipStatus'],
    expiringInDays: number,
  ): Prisma.GymUserWhereInput {
    if (!membershipStatus) {
      return {};
    }

    const today = startOfDayUtc();
    const live: Prisma.SubscriptionWhereInput = {
      cancelledAt: null,
      startDate: { lte: today },
      endDate: { gte: today },
    };

    const expiringSoon: Prisma.SubscriptionWhereInput = {
      ...live,
      endDate: {
        gte: today,
        lte: new Date(today.getTime() + expiringInDays * 86_400_000),
      },
    };

    switch (membershipStatus) {
      case 'ACTIVE':
        // Deliberately a superset of EXPIRING: someone expiring tomorrow is
        // still active today. Use ACTIVE_NOT_EXPIRING for the disjoint slice.
        return { subscriptions: { some: live } };
      case 'EXPIRING':
        return { subscriptions: { some: expiringSoon } };
      case 'ACTIVE_NOT_EXPIRING':
        return {
          AND: [
            { subscriptions: { some: live } },
            { subscriptions: { none: expiringSoon } },
          ],
        };
      case 'EXPIRED':
        // Anything in their history, but nothing live now. Deliberately counts
        // cancelled-only members: requiring a non-cancelled subscription here
        // used to drop them out of every bucket, so the buckets did not sum to
        // the member count.
        return {
          AND: [
            { subscriptions: { some: {} } },
            { subscriptions: { none: live } },
          ],
        };
      case 'NONE':
        return { subscriptions: { none: {} } };
    }
  }

  /// Counts for the dashboard.
  ///
  /// `buckets` is a true partition - the four sum to `totalMembers` - because
  /// summing the membershipStatus filters does not work: EXPIRING is a subset
  /// of ACTIVE, so adding them double-counts. `activeTotal` is the figure to
  /// show as "active members".
  async stats(gymId: string, query: MemberStatsDto): Promise<MemberStats> {
    const { expiringInDays, status, source } = query;

    const base: Prisma.GymUserWhereInput = {
      gymId,
      role: GymRole.MEMBER,
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
    };

    const countWith = (extra: Prisma.GymUserWhereInput) =>
      this.prisma.gymUser.count({ where: { ...base, ...extra } });

    const [totalMembers, activeTotal, expiringSoon, expired, never] =
      await this.prisma.$transaction([
        countWith({}),
        countWith(this.membershipFilter('ACTIVE', expiringInDays)),
        countWith(this.membershipFilter('EXPIRING', expiringInDays)),
        countWith(this.membershipFilter('EXPIRED', expiringInDays)),
        countWith(this.membershipFilter('NONE', expiringInDays)),
      ]);

    return {
      totalMembers,
      expiringInDays,
      activeTotal,
      buckets: {
        // Derived rather than queried, so it can never disagree with the two
        // counts it sits between.
        active: activeTotal - expiringSoon,
        expiringSoon,
        expired,
        never,
      },
    };
  }

  async findOne(gymId: string, memberId: string): Promise<MemberView> {
    return this.toView(await this.getMemberOrThrow(gymId, memberId));
  }

  async update(
    gymId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<MemberView> {
    const member = await this.getMemberOrThrow(gymId, memberId);

    // undefined leaves a column alone, null clears it. Prisma ignores undefined
    // values, so every field can be assigned unconditionally.
    const userData: Prisma.UserUpdateInput = {
      fullName: patchField(dto.fullName, (v) => v.trim()),
      email: patchField(dto.email, (v) => v.toLowerCase()),
      // Re-verification is needed whether the address changed or was removed.
      emailVerified: dto.email === undefined ? undefined : false,
      // gender is not nullable in the database; UNDISCLOSED is its "cleared".
      gender: dto.gender === null ? Gender.UNDISCLOSED : dto.gender,
      dateOfBirth: patchField(dto.dateOfBirth, (v) => new Date(v)),
      heightCm: dto.heightCm,
      weightKg: dto.weightKg,
    };

    const gymUserData: Prisma.GymUserUpdateInput = {
      goal: dto.goal,
      activityLevel: dto.activityLevel,
      medicalNotes: dto.medicalNotes,
      notes: dto.notes,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: patchField(dto.emergencyContactPhone, toE164),
    };

    const [, updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: member.userId },
        data: userData,
      }),
      this.prisma.gymUser.update({
        where: { id: member.id },
        data: gymUserData,
        include: { user: true, subscriptions: CURRENT_SUBSCRIPTION },
      }),
    ]);

    return this.toView(updated);
  }

  /// Ends someone's access to this gym. Their record and history stay; only
  /// their ability to use the app here stops.
  async deactivate(
    gymId: string,
    memberId: string,
    dto: DeactivateMemberDto,
  ): Promise<MemberView> {
    const member = await this.getMemberOrThrow(gymId, memberId);

    if (member.status !== GymUserStatus.ACTIVE) {
      throw new BadRequestException('This member is already inactive');
    }

    const updated = await this.prisma.gymUser.update({
      where: { id: member.id },
      data: {
        status: dto.status,
        deactivatedAt: new Date(),
        notes: dto.reason
          ? `${member.notes ? `${member.notes}\n` : ''}[${dto.status}] ${dto.reason}`
          : member.notes,
      },
      include: { user: true, subscriptions: CURRENT_SUBSCRIPTION },
    });

    // Kill their sessions at this gym only - they may be a member elsewhere.
    await this.tokens.revokeAllForUser(member.userId, gymId);

    this.logger.log(
      `Member ${member.memberCode ?? member.id} set to ${dto.status} at gym ${gymId}`,
    );
    return this.toView(updated);
  }

  async reactivate(gymId: string, memberId: string): Promise<MemberView> {
    const member = await this.getMemberOrThrow(gymId, memberId);

    if (member.status === GymUserStatus.ACTIVE) {
      throw new BadRequestException('This member is already active');
    }

    const updated = await this.prisma.gymUser.update({
      where: { id: member.id },
      data: { status: GymUserStatus.ACTIVE, deactivatedAt: null },
      include: { user: true, subscriptions: CURRENT_SUBSCRIPTION },
    });
    return this.toView(updated);
  }

  private async getMemberOrThrow(
    gymId: string,
    memberId: string,
  ): Promise<GymUserWithUser> {
    const member = await this.prisma.gymUser.findFirst({
      where: { id: memberId, gymId, role: GymRole.MEMBER },
      include: { user: true, subscriptions: CURRENT_SUBSCRIPTION },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }

  private async reactivateExisting(
    gymUserId: string,
    dto: CreateMemberDto,
  ): Promise<MemberView> {
    const updated = await this.prisma.gymUser.update({
      where: { id: gymUserId },
      data: {
        status: GymUserStatus.ACTIVE,
        deactivatedAt: null,
        goal: dto.goal,
        activityLevel: dto.activityLevel,
        medicalNotes: dto.medicalNotes,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone
          ? toE164(dto.emergencyContactPhone)
          : undefined,
      },
      include: { user: true, subscriptions: CURRENT_SUBSCRIPTION },
    });
    this.logger.log(
      `Member ${updated.memberCode} rejoined gym ${updated.gymId}`,
    );
    return this.toView(updated);
  }

  /// A person is shared across gyms, so registering them here must not rewrite
  /// details another gym already holds - we only fill in what is missing.
  private fillBlanksOnly(
    user: User,
    dto: CreateMemberDto,
  ): Prisma.UserUpdateInput {
    return {
      ...(user.fullName ? {} : { fullName: dto.fullName.trim() }),
      ...(user.email || !dto.email ? {} : { email: dto.email.toLowerCase() }),
      ...(user.dateOfBirth || !dto.dateOfBirth
        ? {}
        : { dateOfBirth: new Date(dto.dateOfBirth) }),
      ...(user.heightCm || !dto.heightCm ? {} : { heightCm: dto.heightCm }),
      ...(user.weightKg || !dto.weightKg ? {} : { weightKg: dto.weightKg }),
    };
  }

  private toView(member: GymUserWithUser): MemberView {
    const { user } = member;
    return {
      id: member.id,
      userId: user.id,
      memberCode: member.memberCode,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      heightCm: user.heightCm ? Number(user.heightCm) : null,
      weightKg: user.weightKg ? Number(user.weightKg) : null,
      goal: member.goal,
      activityLevel: member.activityLevel,
      medicalNotes: member.medicalNotes,
      notes: member.notes,
      emergencyContactName: member.emergencyContactName,
      emergencyContactPhone: member.emergencyContactPhone,
      status: member.status,
      source: member.source,
      // Tells the front desk whether this person has ever logged in, so they
      // know to nudge them to install the app.
      hasAppAccount: user.phoneVerified,
      onboarded: member.onboardedAt !== null,
      joinedAt: member.joinedAt,
      lastVisitAt: member.lastVisitAt,
      membership: summariseFor(member.subscriptions ?? []),
    };
  }
}
