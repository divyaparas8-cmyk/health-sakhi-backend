const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const appointments = await prisma.appointment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { include: { profile: true } },
      advisor: { include: { user: { include: { profile: true } } } }
    }
  });

  console.log(`Total appointments in DB: ${appointments.length}`);
  for (const appt of appointments) {
    console.log(`- ID: ${appt.id}`);
    console.log(`  Patient (User Email): ${appt.user.email}`);
    console.log(`  Patient Name: ${appt.user.profile?.fullName}`);
    console.log(`  Advisor: ${appt.advisor.user.profile?.fullName}`);
    console.log(`  Date: ${appt.date.toISOString().split('T')[0]}`);
    console.log(`  Time: ${appt.startTime} - ${appt.endTime}`);
    console.log(`  Status: ${appt.status}`);
    console.log(`  Created At: ${appt.createdAt}`);
    console.log('-------------------------------------------');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
