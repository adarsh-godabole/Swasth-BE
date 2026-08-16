import { GymRole, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokensService } from '../auth/tokens.service';
import { MembersService } from './members.service';

/// The membership buckets are the one place where a filter that is individually
/// correct can still add up to a wrong dashboard, so these assert the set
/// relationships rather than the SQL.
type Where = Prisma.GymUserWhereInput;

function filterFor(
  status: 'ACTIVE' | 'EXPIRING' | 'ACTIVE_NOT_EXPIRING' | 'EXPIRED' | 'NONE',
): Where {
  const service = new MembersService(
    {} as unknown as PrismaService,
    {} as unknown as TokensService,
  );
  // membershipFilter is private, but it is the unit under test.
  return (
    service as unknown as {
      membershipFilter: (s: string, days: number) => Where;
    }
  ).membershipFilter(status, 7);
}

describe('membership buckets', () => {
  it('EXPIRED does not require an uncancelled subscription', () => {
    // Regression: it used to, so a member whose only subscriptions were all
    // cancelled matched no bucket at all and the counts did not add up.
    const expired = filterFor('EXPIRED');
    const [hasHistory, nothingLive] = expired.AND as Where[];

    // "Has any subscription at all" - with no cancelledAt condition, which is
    // what used to exclude cancelled-only members from every bucket.
    expect(hasHistory).toEqual({ subscriptions: { some: {} } });
    // The liveness clause still requires non-cancelled, as it must.
    expect(nothingLive).toHaveProperty('subscriptions.none.cancelledAt', null);
  });

  it('ACTIVE_NOT_EXPIRING excludes the expiring window', () => {
    const filter = filterFor('ACTIVE_NOT_EXPIRING');
    const clauses = filter.AND as Where[];
    expect(clauses).toHaveLength(2);
    expect(clauses[0]).toHaveProperty('subscriptions.some');
    expect(clauses[1]).toHaveProperty('subscriptions.none');
  });

  it('EXPIRING narrows ACTIVE rather than replacing it', () => {
    const active = filterFor('ACTIVE') as {
      subscriptions: { some: Prisma.SubscriptionWhereInput };
    };
    const expiring = filterFor('EXPIRING') as {
      subscriptions: { some: Prisma.SubscriptionWhereInput };
    };
    // Same liveness conditions, plus an upper bound on endDate.
    expect(expiring.subscriptions.some.cancelledAt).toEqual(
      active.subscriptions.some.cancelledAt,
    );
    expect(expiring.subscriptions.some.startDate).toEqual(
      active.subscriptions.some.startDate,
    );
    expect(
      (expiring.subscriptions.some.endDate as { lte?: Date }).lte,
    ).toBeInstanceOf(Date);
    expect(
      (active.subscriptions.some.endDate as { lte?: Date }).lte,
    ).toBeUndefined();
  });

  it('NONE means no subscriptions of any kind', () => {
    expect(filterFor('NONE')).toEqual({ subscriptions: { none: {} } });
  });
});

describe('MembersService.stats', () => {
  /// The counts come back in the order the service queues them:
  /// total, active, expiring, expired, never.
  function buildService(counts: number[]) {
    const transaction = jest.fn().mockResolvedValue(counts);
    const prisma = {
      gymUser: { count: jest.fn() },
      $transaction: transaction,
    } as unknown as PrismaService;
    return new MembersService(prisma, {} as unknown as TokensService);
  }

  it('derives active as the non-expiring remainder, so buckets sum to the total', async () => {
    // 27 members: 5 hold a live membership, 1 of those expires within the week.
    const service = buildService([27, 5, 1, 3, 19]);

    const stats = await service.stats('gym-id', {
      expiringInDays: 7,
    } as never);

    expect(stats.activeTotal).toBe(5);
    expect(stats.buckets).toEqual({
      active: 4,
      expiringSoon: 1,
      expired: 3,
      never: 19,
    });

    const sum = Object.values(stats.buckets).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.totalMembers);
    // The bug this replaces: naively adding the filter totals overshoots.
    expect(5 + 1 + 3 + 19).toBeGreaterThan(stats.totalMembers);
  });

  it('scopes the counts to members of the caller gym', async () => {
    const service = buildService([1, 1, 0, 0, 0]);
    await service.stats('gym-id', { expiringInDays: 7 } as never);

    const prisma = (service as unknown as { prisma: PrismaService }).prisma;
    const firstCount = (prisma.gymUser.count as jest.Mock).mock.calls[0][0];
    expect(firstCount.where).toMatchObject({
      gymId: 'gym-id',
      role: GymRole.MEMBER,
    });
  });
});
