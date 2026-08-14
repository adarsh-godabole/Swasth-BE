import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Gym, GymRole, MemberSource } from '@prisma/client';
import { toE164 } from 'src/common/utils/phone.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGymDto } from './dto/create-gym.dto';

@Injectable()
export class GymsService {
  private readonly logger = new Logger(GymsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /// Onboards a gym. Deliberately platform-admin only - gyms are brought on one
  /// at a time by the Swasth team, not self-serve.
  async create(dto: CreateGymDto): Promise<Gym> {
    const code = dto.code.trim().toLowerCase();
    const ownerPhone = toE164(dto.ownerPhone);

    const clash = await this.prisma.gym.findUnique({ where: { code } });
    if (clash) {
      throw new ConflictException(`A gym with code "${code}" already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: {
          code,
          name: dto.name.trim(),
          legalName: dto.legalName?.trim(),
          phone: toE164(dto.phone),
          email: dto.email?.toLowerCase(),
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          memberCodePrefix: dto.memberCodePrefix ?? 'M',
        },
      });

      // The owner may already exist as a member of another gym - reuse them.
      const owner = await tx.user.upsert({
        where: { phone: ownerPhone },
        update: { fullName: dto.ownerName ?? undefined },
        create: { phone: ownerPhone, fullName: dto.ownerName },
      });

      await tx.gymUser.create({
        data: {
          gymId: gym.id,
          userId: owner.id,
          role: GymRole.OWNER,
          source: MemberSource.FRONT_DESK,
        },
      });

      this.logger.log(`Gym "${gym.code}" onboarded with owner ${owner.id}`);
      return gym;
    });
  }

  async findByCode(code: string): Promise<Gym | null> {
    return this.prisma.gym.findFirst({
      where: { code: code.trim().toLowerCase(), deletedAt: null },
    });
  }

  async list(): Promise<Gym[]> {
    return this.prisma.gym.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /// The public-facing profile the mobile app shows before login.
  async publicProfile(gymId: string) {
    return this.prisma.gym.findUniqueOrThrow({
      where: { id: gymId },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        pincode: true,
        logoUrl: true,
        timezone: true,
        currency: true,
      },
    });
  }
}
