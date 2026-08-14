import { ConflictException } from '@nestjs/common';
import { GymRole, GymUserStatus, MemberSource, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokensService } from '../auth/tokens.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { MembersService } from './members.service';

const GYM_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

const dto: CreateMemberDto = {
  phone: '9876543210',
  fullName: 'Rohit Sharma',
};

/// Minimal fakes - these tests cover the branching in create(), which is where
/// the front-desk edge cases live. Query correctness is left to integration
/// tests against a real database.
function buildService(overrides: {
  findUnique?: jest.Mock;
  txGymUserCreate?: jest.Mock;
  txUserCreate?: jest.Mock;
  gymUpdate?: jest.Mock;
  gymUserUpdate?: jest.Mock;
}) {
  const tx = {
    user: {
      create: overrides.txUserCreate ?? jest.fn(),
      update: jest.fn(),
    },
    gym: {
      update:
        overrides.gymUpdate ??
        jest.fn().mockResolvedValue({ memberCodePrefix: 'SWK-', memberSeq: 1 }),
    },
    gymUser: { create: overrides.txGymUserCreate ?? jest.fn() },
  };

  const prisma = {
    user: { findUnique: overrides.findUnique ?? jest.fn() },
    gymUser: { update: overrides.gymUserUpdate ?? jest.fn() },
    $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
  } as unknown as PrismaService;

  const tokens = { revokeAllForUser: jest.fn() } as unknown as TokensService;

  return { service: new MembersService(prisma, tokens), tx };
}

function gymUserRow(extra: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'gym-user-id',
    gymId: GYM_ID,
    userId: USER_ID,
    role: GymRole.MEMBER,
    status: GymUserStatus.ACTIVE,
    memberCode: 'SWK-0001',
    source: MemberSource.FRONT_DESK,
    goal: null,
    activityLevel: null,
    medicalNotes: null,
    notes: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    onboardedAt: null,
    joinedAt: new Date('2026-08-14'),
    lastVisitAt: null,
    deactivatedAt: null,
    createdAt: new Date('2026-08-14'),
    updatedAt: new Date('2026-08-14'),
    user: {
      id: USER_ID,
      phone: '+919876543210',
      phoneVerified: false,
      fullName: 'Rohit Sharma',
      email: null,
      emailVerified: false,
      gender: 'UNDISCLOSED',
      dateOfBirth: null,
      heightCm: new Prisma.Decimal(175.5),
      weightKg: null,
      avatarUrl: null,
      city: null,
      isPlatformAdmin: false,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date('2026-08-14'),
      updatedAt: new Date('2026-08-14'),
      deletedAt: null,
    },
    ...extra,
  };
}

describe('MembersService.create', () => {
  it('registers an unknown number and issues the next member code', async () => {
    const txGymUserCreate = jest.fn().mockResolvedValue(gymUserRow());
    const txUserCreate = jest.fn().mockResolvedValue({ id: USER_ID });
    const { service, tx } = buildService({
      findUnique: jest.fn().mockResolvedValue(null),
      txUserCreate,
      txGymUserCreate,
    });

    const result = await service.create(GYM_ID, dto);

    // Phone is normalised to E.164 before it is stored.
    expect(txUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+919876543210' }),
      }),
    );
    // The counter is incremented in the same statement that reads it.
    expect(tx.gym.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { memberSeq: { increment: 1 } } }),
    );
    expect(txGymUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberCode: 'SWK-0001',
          role: GymRole.MEMBER,
          source: MemberSource.FRONT_DESK,
        }),
      }),
    );
    expect(result.memberCode).toBe('SWK-0001');
    expect(result.heightCm).toBe(175.5);
    expect(result.hasAppAccount).toBe(false);
  });

  it('refuses to register someone who is already an active member here', async () => {
    const { service } = buildService({
      findUnique: jest.fn().mockResolvedValue({
        id: USER_ID,
        fullName: 'Rohit Sharma',
        deletedAt: null,
        gymUsers: [
          {
            id: 'gym-user-id',
            role: GymRole.MEMBER,
            status: GymUserStatus.ACTIVE,
            memberCode: 'SWK-0001',
          },
        ],
      }),
    });

    await expect(service.create(GYM_ID, dto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('refuses to register a number that already belongs to staff here', async () => {
    const { service } = buildService({
      findUnique: jest.fn().mockResolvedValue({
        id: USER_ID,
        deletedAt: null,
        gymUsers: [
          {
            id: 'gym-user-id',
            role: GymRole.TRAINER,
            status: GymUserStatus.ACTIVE,
            memberCode: null,
          },
        ],
      }),
    });

    await expect(service.create(GYM_ID, dto)).rejects.toThrow(
      /already registered here as trainer/i,
    );
  });

  it('reactivates a member who left, keeping their original code', async () => {
    const gymUserUpdate = jest.fn().mockResolvedValue(gymUserRow());
    const { service, tx } = buildService({
      findUnique: jest.fn().mockResolvedValue({
        id: USER_ID,
        deletedAt: null,
        gymUsers: [
          {
            id: 'gym-user-id',
            role: GymRole.MEMBER,
            status: GymUserStatus.LEFT,
            memberCode: 'SWK-0001',
          },
        ],
      }),
      gymUserUpdate,
    });

    const result = await service.create(GYM_ID, dto);

    expect(gymUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'gym-user-id' },
        data: expect.objectContaining({
          status: GymUserStatus.ACTIVE,
          deactivatedAt: null,
        }),
      }),
    );
    // No new code is minted for someone rejoining.
    expect(tx.gym.update).not.toHaveBeenCalled();
    expect(result.memberCode).toBe('SWK-0001');
  });
});
