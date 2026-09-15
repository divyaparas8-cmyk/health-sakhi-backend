const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.periodLog.deleteMany({});
  const profiles = await prisma.periodProfile.deleteMany({});
  console.log('Deleted logs:', logs.count);
  console.log('Deleted profiles:', profiles.count);
  console.log('Database cleared. Fresh start!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
