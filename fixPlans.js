const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function fix() {
  await prisma.plan.updateMany({
    where: { slug: { in: ['premium-plus', 'healthsakhi-family-wellness-premium'] } },
    data: { status: 'ARCHIVED' }
  });
  await prisma.plan.updateMany({
    where: { slug: { in: ['premium-pro', 'elite'] } },
    data: { status: 'ACTIVE' }
  });
  console.log('Fixed DB plans!');
}
fix().catch(console.error).finally(() => prisma.$disconnect());
