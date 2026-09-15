const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const newPlans = [
  {
    name: 'Free Sakhi',
    slug: 'free-sakhi',
    price: 0,
    interval: 'MONTHLY',
    status: 'ACTIVE',
    maxAiChatsPerDay: 5,
    advisorCredits: 0,
    features: [
      { featureName: 'Videos Access', featureValue: '10' },
      { featureName: 'Books Access', featureValue: '5' },
      { featureName: 'AI Sakhi Chat', featureValue: 'enabled' },
      { featureName: 'Mood Tracker', featureValue: 'basic' },
      { featureName: 'Community', featureValue: 'access' }
    ]
  },
  {
    name: 'Premium Plus',
    slug: 'premium-plus',
    price: 299,
    interval: 'MONTHLY',
    status: 'ACTIVE',
    maxAiChatsPerDay: 999999,
    advisorCredits: 0,
    features: [
      { featureName: 'Videos Access', featureValue: 'Unlimited' },
      { featureName: 'Books Access', featureValue: '20' },
      { featureName: 'AI Sakhi Chat', featureValue: 'enabled' },
      { featureName: 'Mood Tracker', featureValue: 'history' },
      { featureName: 'Community', featureValue: 'wellness circle' }
    ]
  },
  {
    name: 'HealthSakhi Family Wellness Premium',
    slug: 'healthsakhi-family-wellness-premium',
    price: 365,
    interval: 'YEARLY',
    status: 'ACTIVE',
    maxAiChatsPerDay: 999999,
    advisorCredits: 0,
    features: [
      { featureName: 'Videos Access', featureValue: 'Unlimited' },
      { featureName: 'Books Access', featureValue: '30' },
      { featureName: 'AI Sakhi Chat', featureValue: 'enabled' },
      { featureName: 'Language', featureValue: 'English + regional' },
      { featureName: 'Extras', featureValue: 'YT sub + newsletter' }
    ]
  }
];

async function main() {
  console.log('Archiving old plans...');
  await prisma.plan.updateMany({
    data: { status: 'ARCHIVED' }
  });
  console.log('Inserting new plans...');
  for (const p of newPlans) {
    const { features, ...planData } = p;
    const createdPlan = await prisma.plan.create({
      data: {
        ...planData,
        features: {
          create: features
        }
      }
    });
    console.log(`Created plan: ${createdPlan.name}`);
  }
  console.log('Sync complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
