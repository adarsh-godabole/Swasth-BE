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
  User,
} from '@prisma/client';
import { patchField } from 'src/common/utils/patch.util';
import { toE164 } from 'src/common/utils/phone.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokensService } from '../auth/tokens.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { DeactivateMemberDto } from './dto/deactivate-member.dto';
import { ListMembersDto } from './dto/list-members.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

type GymUserWithUser = GymUser & { user: User };

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
}

export interface PaginatedMembers {
  items: MemberView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
        include: { user: true },
      });
    });

    this.logger.log(`Member ${created.memberCode} registered at gym ${gymId}`);
    return this.toView(created);
  }

  async list(gymId: string, query: ListMembersDto): Promise<PaginatedMembers> {
    const { search, status, source, page, limit, sortBy, sortOrder } = query;

    const where: Prisma.GymUserWhereInput = {
      gymId,
      role: GymRole.MEMBER,
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
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
        include: { user: true },
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
        include: { user: true },
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
      include: { user: true },
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
      include: { user: true },
    });
    return this.toView(updated);
  }

  private async getMemberOrThrow(
    gymId: string,
    memberId: string,
  ): Promise<GymUserWithUser> {
    const member = await this.prisma.gymUser.findFirst({
      where: { id: memberId, gymId, role: GymRole.MEMBER },
      include: { user: true },
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
      include: { user: true },
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
    };
  }
}
