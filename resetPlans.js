const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetPlans() {
  console.log('Resetting plans...');
  await prisma.planFeature.deleteMany({});
  await prisma.plan.deleteMany({});

  // 1. Free Sakhi
  await prisma.plan.create({
    data: {
      name: 'Free Sakhi',
      slug: 'free-sakhi',
      price: 0,
      interval: 'LIFETIME',
      status: 'ACTIVE',
      maxAiChatsPerDay: 5,
      advisorCredits: 0,
      features: {
        create: [
          { name: 'Videos', value: 'Access to 10 free videos' },
          { name: 'AI Sakhi', value: '5 chats/day' },
          { name: 'Books', value: '5 free books' },
          { name: 'Mood Tracker', value: 'Mood tracker (basic)' },
          { name: 'Community', value: 'Community access' },
        ]
      }
    }
  });

  // 2. Premium Plus
  await prisma.plan.create({
    data: {
      name: 'Premium Plus',
      slug: 'premium-plus',
      price: 299,
      interval: 'MONTHLY',
      status: 'ACTIVE',
      maxAiChatsPerDay: 999999, // unlimited
      advisorCredits: 0,
      features: {
        create: [
          { name: 'Videos', value: 'Unlimited videos & courses' },
          { name: 'AI Sakhi', value: 'Unlimited chats' },
          { name: 'Books', value: 'Full book library (20 books library)' },
          { name: 'Mood Tracker', value: 'Mood tracker + history' },
          { name: 'Community', value: 'Community wellness circle' },
        ]
      }
    }
  });

  // 3. HealthSakhi Family Wellness Premium
  await prisma.plan.create({
    data: {
      name: 'HealthSakhi Family Wellness Premium',
      slug: 'healthsakhi-family-wellness-premium',
      price: 365,
      interval: 'YEARLY',
      status: 'ACTIVE',
      maxAiChatsPerDay: 999999,
      advisorCredits: 0,
      features: {
        create: [
          { name: 'Books', value: '30 books' },
          { name: 'Languages', value: 'English + regional languages' },
          { name: 'Youtube', value: 'YT subscription' },
          { name: 'Newsletter', value: 'Monthly newsletter/blogs' },
        ]
      }
    }
  });

  console.log('Plans created successfully!');
}

resetPlans()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
