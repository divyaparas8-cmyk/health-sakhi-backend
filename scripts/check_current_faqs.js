const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database and fetching FAQ count...');
  const count = await prisma.faq.count();
  console.log(`Current FAQ count in database: ${count}`);

  const sample = await prisma.faq.findMany({
    take: 5,
    orderBy: { displayOrder: 'asc' }
  });
  console.log('Sample existing FAQs:');
  sample.forEach(f => {
    console.log(`- [#${f.displayOrder}] (${f.category}) ${f.question}`);
  });
}

main()
  .catch(e => {
    console.error('Error connecting to database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
