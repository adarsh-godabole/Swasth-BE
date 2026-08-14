import { ConflictException } from '@nestjs/common';
import {
  Gender,
  GymRole,
  GymUserStatus,
  MemberSource,
  Prisma,
} from '@prisma/client';
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
  gymUserFindFirst?: jest.Mock;
  userUpdate?: jest.Mock;
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
    user: {
      findUnique: overrides.findUnique ?? jest.fn(),
      update: overrides.userUpdate ?? jest.fn(),
    },
    gymUser: {
      update: overrides.gymUserUpdate ?? jest.fn(),
      findFirst: overrides.gymUserFindFirst ?? jest.fn(),
    },
    // Callback form runs the callback; array form (used by update) resolves the
    // promises it was handed.
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => unknown)(tx)
        : Promise.all(arg as unknown[]),
    ),
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

describe('MembersService.update', () => {
  /// PATCH contract: a field left out is untouched, a field sent as null is
  /// cleared. These four used to 500 or silently corrupt the row, because
  /// @IsOptional() lets null past the DTO and the transforms assumed a string.
  function buildForUpdate() {
    const userUpdate = jest.fn().mockResolvedValue({});
    const gymUserUpdate = jest.fn().mockResolvedValue(gymUserRow());
    const { service } = buildService({
      gymUserFindFirst: jest.fn().mockResolvedValue(gymUserRow()),
      userUpdate,
      gymUserUpdate,
    });
    return { service, userUpdate, gymUserUpdate };
  }

  const userDataOf = (mock: jest.Mock) => mock.mock.calls[0][0].data;

  it('clears email, gender, dateOfBirth and emergency phone when sent null', async () => {
    const { service, userUpdate, gymUserUpdate } = buildForUpdate();

    await service.update(GYM_ID, 'gym-user-id', {
      email: null,
      gender: null,
      dateOfBirth: null,
      emergencyContactPhone: null,
    });

    const userData = userDataOf(userUpdate);
    expect(userData.email).toBeNull();
    // gender is not nullable in the database - UNDISCLOSED is its cleared state.
    expect(userData.gender).toBe(Gender.UNDISCLOSED);
    // Must be null, not the Unix epoch that new Date(null) produces.
    expect(userData.dateOfBirth).toBeNull();
    expect(userData.emailVerified).toBe(false);
    expect(userDataOf(gymUserUpdate).emergencyContactPhone).toBeNull();
  });

  it('leaves omitted fields untouched', async () => {
    const { service, userUpdate, gymUserUpdate } = buildForUpdate();

    await service.update(GYM_ID, 'gym-user-id', { fullName: 'Rohit S' });

    const userData = userDataOf(userUpdate);
    expect(userData.fullName).toBe('Rohit S');
    // Prisma reads undefined as "don't touch this column".
    expect(userData.email).toBeUndefined();
    expect(userData.gender).toBeUndefined();
    expect(userData.dateOfBirth).toBeUndefined();
    expect(userData.emailVerified).toBeUndefined();
    expect(userDataOf(gymUserUpdate).goal).toBeUndefined();
  });

  it('still transforms real values', async () => {
    const { service, userUpdate, gymUserUpdate } = buildForUpdate();

    await service.update(GYM_ID, 'gym-user-id', {
      email: 'ROHIT@Example.COM',
      dateOfBirth: '1995-04-17',
      emergencyContactPhone: '9812345678',
    });

    const userData = userDataOf(userUpdate);
    expect(userData.email).toBe('rohit@example.com');
    expect(userData.dateOfBirth).toEqual(new Date('1995-04-17'));
    expect(userDataOf(gymUserUpdate).emergencyContactPhone).toBe(
      '+919812345678',
    );
  });
});
