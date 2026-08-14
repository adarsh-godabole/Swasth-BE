import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DurationUnit, Plan, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

export interface PlanView {
  id: string;
  name: string;
  description: string | null;
  durationValue: number;
  durationUnit: DurationUnit;
  /// "3 months", "1 day" - ready to render.
  durationLabel: string;
  price: number;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  archivedAt: Date | null;
  /// How many subscriptions have ever been sold on this plan.
  timesSold?: number;
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(gymId: string, dto: CreatePlanDto): Promise<PlanView> {
    const name = dto.name.trim();

    const clash = await this.prisma.plan.findFirst({ where: { gymId, name } });
    if (clash) {
      throw new ConflictException(`A plan called "${name}" already exists`);
    }

    const plan = await this.prisma.plan.create({
      data: {
        gymId,
        name,
        description: dto.description,
        durationValue: dto.durationValue,
        durationUnit: dto.durationUnit,
        price: dto.price,
        isActive: dto.isActive ?? true,
        isPublic: dto.isPublic ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return this.toView(plan);
  }

  /// Staff see everything; the member app sees only active, public, unarchived
  /// plans.
  async list(gymId: string, publicOnly: boolean): Promise<PlanView[]> {
    const where: Prisma.PlanWhereInput = publicOnly
      ? { gymId, isActive: true, isPublic: true, archivedAt: null }
      : { gymId };

    const plans = await this.prisma.plan.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
      ...(publicOnly
        ? {}
        : { include: { _count: { select: { subscriptions: true } } } }),
    });

    return plans.map((plan) =>
      this.toView(
        plan,
        (plan as Plan & { _count?: { subscriptions: number } })._count
          ?.subscriptions,
      ),
    );
  }

  async findOne(gymId: string, planId: string): Promise<PlanView> {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, gymId },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return this.toView(plan, plan._count.subscriptions);
  }

  async update(
    gymId: string,
    planId: string,
    dto: UpdatePlanDto,
  ): Promise<PlanView> {
    await this.findOne(gymId, planId);

    if (dto.name) {
      const clash = await this.prisma.plan.findFirst({
        where: { gymId, name: dto.name.trim(), id: { not: planId } },
      });
      if (clash) {
        throw new ConflictException(
          `A plan called "${dto.name.trim()}" already exists`,
        );
      }
    }

    const plan = await this.prisma.plan.update({
      where: { id: planId },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        durationValue: dto.durationValue,
        durationUnit: dto.durationUnit,
        price: dto.price,
        isActive: dto.isActive,
        isPublic: dto.isPublic,
        sortOrder: dto.sortOrder,
      },
    });
    return this.toView(plan);
  }

  /// Plans are archived rather than deleted - subscriptions sold on them are
  /// part of the gym's history.
  async archive(gymId: string, planId: string): Promise<PlanView> {
    const existing = await this.findOne(gymId, planId);
    if (existing.archivedAt) {
      throw new BadRequestException('This plan is already archived');
    }
    const plan = await this.prisma.plan.update({
      where: { id: planId },
      data: { archivedAt: new Date(), isActive: false, isPublic: false },
    });
    return this.toView(plan);
  }

  async restore(gymId: string, planId: string): Promise<PlanView> {
    const existing = await this.findOne(gymId, planId);
    if (!existing.archivedAt) {
      throw new BadRequestException('This plan is not archived');
    }
    const plan = await this.prisma.plan.update({
      where: { id: planId },
      data: { archivedAt: null, isActive: true },
    });
    return this.toView(plan);
  }

  /// Used by the subscriptions service - a plan must be sellable to be sold.
  async getSellable(gymId: string, planId: string): Promise<Plan> {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, gymId },
    });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    if (!plan.isActive || plan.archivedAt) {
      throw new BadRequestException(
        `"${plan.name}" is no longer on sale. Reactivate it first.`,
      );
    }
    return plan;
  }

  private toView(plan: Plan, timesSold?: number): PlanView {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      durationValue: plan.durationValue,
      durationUnit: plan.durationUnit,
      durationLabel: describeDuration(plan.durationValue, plan.durationUnit),
      price: Number(plan.price),
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      sortOrder: plan.sortOrder,
      archivedAt: plan.archivedAt,
      ...(timesSold === undefined ? {} : { timesSold }),
    };
  }
}

export function describeDuration(value: number, unit: DurationUnit): string {
  const noun = unit === DurationUnit.MONTH ? 'month' : 'day';
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}
