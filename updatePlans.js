const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePlans() {
  console.log('Updating plans...');
  
  // Free Sakhi
  const freeSakhi = await prisma.plan.findFirst({ where: { slug: 'free-sakhi', deletedAt: null } });
  if (freeSakhi) {
    await prisma.planFeature.deleteMany({ where: { planId: freeSakhi.id } });
    await prisma.plan.update({
      where: { id: freeSakhi.id },
      data: {
        name: 'Free Sakhi', price: 0, interval: 'MONTHLY', status: 'ACTIVE',
        features: { create: [
          { featureName: 'Videos', featureValue: 'Access to 10 free videos' },
          { featureName: 'AI Sakhi', featureValue: '5 chats/day' },
          { featureName: 'Books', featureValue: '5 free books' },
          { featureName: 'Mood Tracker', featureValue: 'Mood tracker (basic)' },
          { featureName: 'Community', featureValue: 'Community access' },
        ]}
      }
    });
  }

  // Premium Pro -> Premium Plus
  const premium = await prisma.plan.findFirst({ where: { slug: 'premium-pro', deletedAt: null } });
  if (premium) {
    await prisma.planFeature.deleteMany({ where: { planId: premium.id } });
    await prisma.plan.update({
      where: { id: premium.id },
      data: {
        name: 'Premium Plus', slug: 'premium-plus', price: 299, interval: 'MONTHLY', status: 'ACTIVE',
        features: { create: [
          { featureName: 'Videos', featureValue: 'Unlimited videos & courses' },
          { featureName: 'AI Sakhi', featureValue: 'Unlimited chats' },
          { featureName: 'Books', featureValue: 'Full book library (20 books library)' },
          { featureName: 'Mood Tracker', featureValue: 'Mood tracker + history' },
          { featureName: 'Community', featureValue: 'Community wellness circle' },
        ]}
      }
    });
  }

  // Elite -> HealthSakhi Family Wellness Premium
  const elite = await prisma.plan.findFirst({ where: { slug: 'elite', deletedAt: null } });
  if (elite) {
    await prisma.planFeature.deleteMany({ where: { planId: elite.id } });
    await prisma.plan.update({
      where: { id: elite.id },
      data: {
        name: 'HealthSakhi Family Wellness Premium', slug: 'healthsakhi-family-wellness-premium', price: 365, interval: 'YEARLY', status: 'ACTIVE',
        features: { create: [
          { featureName: 'Books', featureValue: '30 books' },
          { featureName: 'Languages', featureValue: 'English + regional languages' },
          { featureName: 'Youtube', featureValue: 'YT subscription' },
          { featureName: 'Newsletter', featureValue: 'Monthly newsletter/blogs' },
        ]}
      }
    });
  }
  console.log('Plans updated successfully!');
}

updatePlans()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
