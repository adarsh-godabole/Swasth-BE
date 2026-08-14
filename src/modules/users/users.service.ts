import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

export type UserProfile = Omit<User, 'deletedAt' | 'heightCm' | 'weightKg'> & {
  heightCm: number | null;
  weightKg: number | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserProfile> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toProfile(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<UserProfile> {
    await this.findById(id);

    const data: Prisma.UserUpdateInput = {
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

    const updated = await this.prisma.user.update({ where: { id }, data });
    return this.toProfile(updated);
  }

  /// Marks onboarding complete. Idempotent - the first timestamp is kept.
  async completeOnboarding(id: string): Promise<UserProfile> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.onboardedAt) {
      return this.toProfile(user);
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { onboardedAt: new Date() },
    });
    return this.toProfile(updated);
  }

  /// Soft delete - the phone number is released so it can register again.
  async deleteAccount(id: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: now,
          isActive: false,
          email: null,
          phone: `deleted:${id}`,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  /// Prisma returns Decimal for numeric columns; the mobile client wants plain
  /// numbers, and deletedAt is never exposed.
  private toProfile(user: User): UserProfile {
    const { deletedAt: _deletedAt, heightCm, weightKg, ...rest } = user;
    return {
      ...rest,
      heightCm: heightCm ? Number(heightCm) : null,
      weightKg: weightKg ? Number(weightKg) : null,
    };
  }
}
