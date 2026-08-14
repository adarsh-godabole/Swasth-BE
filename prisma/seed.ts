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

  console.log(`Seeded gym "${gym.code}"`);
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
