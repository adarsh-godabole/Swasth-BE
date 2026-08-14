import { Injectable, NotFoundException } from '@nestjs/common';
import { Gender, GymUser, Prisma, Subscription, User } from '@prisma/client';
import { patchField } from 'src/common/utils/patch.util';
import { toE164 } from 'src/common/utils/phone.util';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  MembershipSummary,
  summariseFor,
} from '../subscriptions/subscriptions.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/// The live or most recent non-cancelled membership.
const CURRENT_SUBSCRIPTION = {
  where: { cancelledAt: null },
  orderBy: { endDate: 'desc' },
  take: 5,
} satisfies Prisma.GymUser$subscriptionsArgs;

/// What the logged-in person sees about themselves: who they are, plus who they
/// are *at this gym*.
export interface MyProfile {
  id: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  emailVerified: boolean;
  gender: User['gender'];
  dateOfBirth: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  avatarUrl: string | null;
  city: string | null;
  membership: {
    gymId: string;
    role: GymUser['role'];
    status: GymUser['status'];
    memberCode: string | null;
    goal: GymUser['goal'];
    activityLevel: GymUser['activityLevel'];
    medicalNotes: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    onboarded: boolean;
    joinedAt: Date;
    lastVisitAt: Date | null;
  };
  /// The plan they hold right now - what the app home screen leads with.
  /// Null means they have never bought one (a visitor).
  subscription: MembershipSummary | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string, gymId: string): Promise<MyProfile> {
    const gymUser = await this.prisma.gymUser.findUnique({
      where: { gymId_userId: { gymId, userId } },
      include: { user: true, subscriptions: CURRENT_SUBSCRIPTION },
    });
    if (!gymUser || gymUser.user.deletedAt) {
      throw new NotFoundException('User not found');
    }
    return this.toProfile(gymUser.user, gymUser);
  }

  async updateMe(
    userId: string,
    gymId: string,
    dto: UpdateProfileDto,
  ): Promise<MyProfile> {
    await this.findMe(userId, gymId);

    // undefined leaves a column alone, null clears it - see patch.util.
    const userData: Prisma.UserUpdateInput = {
      fullName: patchField(dto.fullName, (v) => v.trim()),
      email: patchField(dto.email, (v) => v.toLowerCase()),
      emailVerified: dto.email === undefined ? undefined : false,
      // gender is not nullable in the database; UNDISCLOSED is its "cleared".
      gender: dto.gender === null ? Gender.UNDISCLOSED : dto.gender,
      dateOfBirth: patchField(dto.dateOfBirth, (v) => new Date(v)),
      heightCm: dto.heightCm,
      weightKg: dto.weightKg,
      city: dto.city,
      avatarUrl: dto.avatarUrl,
    };

    const gymUserData: Prisma.GymUserUpdateInput = {
      goal: dto.goal,
      activityLevel: dto.activityLevel,
      medicalNotes: dto.medicalNotes,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: patchField(dto.emergencyContactPhone, toE164),
    };

    const [user, gymUser] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: userData }),
      this.prisma.gymUser.update({
        where: { gymId_userId: { gymId, userId } },
        data: gymUserData,
        include: { subscriptions: CURRENT_SUBSCRIPTION },
      }),
    ]);

    return this.toProfile(user, gymUser);
  }

  /// Marks this gym's onboarding complete. Idempotent - the first timestamp is
  /// kept. Onboarding is per gym, since each gym asks its own questions.
  async completeOnboarding(userId: string, gymId: string): Promise<MyProfile> {
    const current = await this.findMe(userId, gymId);
    if (current.membership.onboarded) {
      return current;
    }

    const gymUser = await this.prisma.gymUser.update({
      where: { gymId_userId: { gymId, userId } },
      data: { onboardedAt: new Date() },
      include: { user: true, subscriptions: CURRENT_SUBSCRIPTION },
    });
    return this.toProfile(gymUser.user, gymUser);
  }

  /// Soft delete of the person across every gym. The phone number is released
  /// so it can be registered again.
  async deleteAccount(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: now,
          isActive: false,
          email: null,
          phone: `deleted:${userId}`,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  /// Prisma returns Decimal for numeric columns; the mobile client wants plain
  /// numbers.
  private toProfile(
    user: User,
    gymUser: GymUser & { subscriptions?: Subscription[] },
  ): MyProfile {
    return {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      emailVerified: user.emailVerified,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      heightCm: user.heightCm ? Number(user.heightCm) : null,
      weightKg: user.weightKg ? Number(user.weightKg) : null,
      avatarUrl: user.avatarUrl,
      city: user.city,
      membership: {
        gymId: gymUser.gymId,
        role: gymUser.role,
        status: gymUser.status,
        memberCode: gymUser.memberCode,
        goal: gymUser.goal,
        activityLevel: gymUser.activityLevel,
        medicalNotes: gymUser.medicalNotes,
        emergencyContactName: gymUser.emergencyContactName,
        emergencyContactPhone: gymUser.emergencyContactPhone,
        onboarded: gymUser.onboardedAt !== null,
        joinedAt: gymUser.joinedAt,
        lastVisitAt: gymUser.lastVisitAt,
      },
      subscription: summariseFor(gymUser.subscriptions ?? []),
    };
  }
}
