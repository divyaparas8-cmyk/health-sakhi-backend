const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Reading approved 175 FAQ dataset content...');
  const jsonPath = path.join(__dirname, '../src/data/faqs_175_dataset.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('faqs_175_dataset.json not found at:', jsonPath);
    process.exit(1);
  }
  
  const faqsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${faqsData.length} FAQs from approved dataset.`);

  console.log('Cleaning existing FAQs...');
  await prisma.faq.deleteMany();

  console.log('Seeding FAQs to database...');
  await prisma.faq.createMany({
    data: faqsData
  });

  console.log('FAQ seeding completed successfully! Total FAQs:', faqsData.length);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
