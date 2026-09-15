const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function fix() {
  await prisma.planFeature.deleteMany({
    where: { plan: { slug: { in: ['premium-plus', 'healthsakhi-family-wellness-premium'] } } }
  });
  await prisma.plan.deleteMany({
    where: { slug: { in: ['premium-plus', 'healthsakhi-family-wellness-premium'] } }
  });
  console.log('Deleted extra plans!');
}
fix().catch(console.error).finally(() => prisma.$disconnect());
