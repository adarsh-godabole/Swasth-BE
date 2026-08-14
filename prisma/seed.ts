import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { phone: '+919999900001' },
    update: {},
    create: {
      phone: '+919999900001',
      phoneVerified: true,
      fullName: 'Swasth Admin',
      role: Role.SUPER_ADMIN,
      onboardedAt: new Date(),
    },
  });

  const member = await prisma.user.upsert({
    where: { phone: '+919999900002' },
    update: {},
    create: {
      phone: '+919999900002',
      phoneVerified: true,
      fullName: 'Test Member',
      city: 'Bengaluru',
      role: Role.MEMBER,
    },
  });

  console.log(`Seeded users: ${admin.phone} (admin), ${member.phone} (member)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
