const prisma = require('./src/config/database');
const service = require('./src/modules/landing-page/service');

async function main() {
  console.log('Clearing existing landing page sections...');
  await prisma.landingPageSection.deleteMany();
  console.log('Seeding updated sections...');
  await service.getLandingPage(); // This triggers seedIfEmpty() and caches the result
  console.log('Reseed successful!');
}

main()
  .catch(e => {
    console.error('Reseed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
