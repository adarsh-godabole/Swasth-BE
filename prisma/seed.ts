import { GymRole, MemberSource, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GYM_CODE = 'swasth-koramangala';

async function main(): Promise<void> {
  // The Swasth team account - onboards gyms, belongs to none.
  const platformAdmin = await prisma.user.upsert({
    where: { phone: '+919999900001' },
    update: { isPlatformAdmin: true },
    create: {
      phone: '+919999900001',
      phoneVerified: true,
      fullName: 'Swasth Platform Admin',
      isPlatformAdmin: true,
    },
  });

  const gym = await prisma.gym.upsert({
    where: { code: GYM_CODE },
    update: {},
    create: {
      code: GYM_CODE,
      // Fixed in the seed so the dev poster and the deep link stay stable
      // across reseeds; real gyms get a random one on onboarding.
      checkInCode: 'SWK7M29Q',
      name: 'Swasth Fitness, Koramangala',
      phone: '+918012345678',
      addressLine1: '80 Feet Road, 6th Block',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560095',
      memberCodePrefix: 'SWK-',
    },
  });

  const owner = await prisma.user.upsert({
    where: { phone: '+919999900002' },
    update: {},
    create: {
      phone: '+919999900002',
      phoneVerified: true,
      fullName: 'Ramesh Kumar',
    },
  });

  await prisma.gymUser.upsert({
    where: { gymId_userId: { gymId: gym.id, userId: owner.id } },
    update: { role: GymRole.OWNER },
    create: {
      gymId: gym.id,
      userId: owner.id,
      role: GymRole.OWNER,
      source: MemberSource.FRONT_DESK,
    },
  });

  const admin = await prisma.user.upsert({
    where: { phone: '+919999900003' },
    update: {},
    create: {
      phone: '+919999900003',
      phoneVerified: true,
      fullName: 'Meera Front Desk',
    },
  });

  await prisma.gymUser.upsert({
    where: { gymId_userId: { gymId: gym.id, userId: admin.id } },
    update: { role: GymRole.GYM_ADMIN },
    create: {
      gymId: gym.id,
      userId: admin.id,
      role: GymRole.GYM_ADMIN,
      source: MemberSource.FRONT_DESK,
    },
  });

  // A gym with no plans cannot sell anything, so give it a starting price list.
  const plans = [
    { name: 'Day Pass', durationValue: 1, unit: 'DAY', price: 300, sort: 0 },
    { name: '1 Month', durationValue: 1, unit: 'MONTH', price: 1800, sort: 1 },
    { name: '3 Months', durationValue: 3, unit: 'MONTH', price: 4500, sort: 2 },
    { name: '6 Months', durationValue: 6, unit: 'MONTH', price: 8000, sort: 3 },
    { name: 'Annual', durationValue: 12, unit: 'MONTH', price: 15000, sort: 4 },
  ] as const;

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { gymId_name: { gymId: gym.id, name: plan.name } },
      update: {},
      create: {
        gymId: gym.id,
        name: plan.name,
        durationValue: plan.durationValue,
        durationUnit: plan.unit,
        price: plan.price,
        sortOrder: plan.sort,
      },
    });
  }

  console.log(`Seeded gym "${gym.code}" with ${plans.length} plans`);
  console.log(`  Platform admin : ${platformAdmin.phone}`);
  console.log(`  Owner          : ${owner.phone}`);
  console.log(`  Gym admin      : ${admin.phone}`);
  console.log('Log in with any of these numbers using OTP_DEV_MODE=true.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
