const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const advisorUser = await prisma.user.findFirst({
    where: { email: 'advisor@healthsakhi.in' },
    include: { advisor: true }
  });

  if (!advisorUser || !advisorUser.advisor) {
    console.error('Advisor not found! Please run prisma seed first.');
    return;
  }

  const advisorId = advisorUser.advisor.id;
  console.log(`Found Advisor Dr. Sakshi Sharma with ID: ${advisorId}`);

  // Create slots for the next 7 days
  const slotsToCreate = [];
  const times = [
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' }
  ];

  for (let i = 0; i < 7; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + i);
    // Format date as YYYY-MM-DD to store in DB date field correctly or use new Date(Date.UTC(...))
    const dateStr = targetDate.toISOString().split('T')[0];
    const dateObj = new Date(dateStr);

    for (const time of times) {
      slotsToCreate.push({
        advisorId,
        date: dateObj,
        startTime: time.start,
        endTime: time.end,
        status: 'available'
      });
    }
  }

  console.log(`Creating ${slotsToCreate.length} availability slots...`);
  
  let createdCount = 0;
  for (const slot of slotsToCreate) {
    try {
      await prisma.advisorAvailability.upsert({
        where: {
          advisorId_date_startTime: {
            advisorId: slot.advisorId,
            date: slot.date,
            startTime: slot.startTime
          }
        },
        update: {
          status: 'available'
        },
        create: slot
      });
      createdCount++;
    } catch (err) {
      // Ignore duplicates or other issues
    }
  }

  console.log(`Successfully created/updated ${createdCount} slots!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
