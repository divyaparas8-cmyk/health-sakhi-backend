const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const circles = [
  { name: 'PCOD Support', description: 'Discuss PCOD management and healing in a safe space.', icon: 'Heart', color: '#ff69b4' },
  { name: 'Moms Circle', description: 'Connecting moms for emotional and physical wellbeing.', icon: 'Users', color: '#8b5cf6' },
  { name: 'Stress Support', description: 'Helping each other find calm in daily chaos.', icon: 'Shield', color: '#0ea5e9' },
  { name: 'Confidence', description: 'Empowering women to lead with inner strength.', icon: 'Star', color: '#f59e0b' }
];

async function main() {
  console.log('Seeding community circles...');
  for (const c of circles) {
    await prisma.communityCircle.upsert({
      where: { name: c.name },
      update: c,
      create: c
    });
  }
  console.log('Community circles seeded successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
