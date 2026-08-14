import { Injectable, NotFoundException } from '@nestjs/common';
import { GymUser, Prisma, User } from '@prisma/client';
import { toE164 } from 'src/common/utils/phone.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string, gymId: string): Promise<MyProfile> {
    const gymUser = await this.prisma.gymUser.findUnique({
      where: { gymId_userId: { gymId, userId } },
      include: { user: true },
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

    const userData: Prisma.UserUpdateInput = {
      ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      ...(dto.email !== undefined && {
        email: dto.email.toLowerCase(),
        emailVerified: false,
      }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.dateOfBirth !== undefined && {
        dateOfBirth: new Date(dto.dateOfBirth),
      }),
      ...(dto.heightCm !== undefined && { heightCm: dto.heightCm }),
      ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
    };

    const gymUserData: Prisma.GymUserUpdateInput = {
      ...(dto.goal !== undefined && { goal: dto.goal }),
      ...(dto.activityLevel !== undefined && {
        activityLevel: dto.activityLevel,
      }),
      ...(dto.medicalNotes !== undefined && { medicalNotes: dto.medicalNotes }),
      ...(dto.emergencyContactName !== undefined && {
        emergencyContactName: dto.emergencyContactName,
      }),
      ...(dto.emergencyContactPhone !== undefined && {
        emergencyContactPhone: toE164(dto.emergencyContactPhone),
      }),
    };

    const [user, gymUser] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: userData }),
      this.prisma.gymUser.update({
        where: { gymId_userId: { gymId, userId } },
        data: gymUserData,
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
      include: { user: true },
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
  private toProfile(user: User, gymUser: GymUser): MyProfile {
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
    };
  }
}
