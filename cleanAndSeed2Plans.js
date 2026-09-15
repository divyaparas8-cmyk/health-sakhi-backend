const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning plans database to strictly 2 plans: Free Sakhi & Premium Sakhi...');

  // Set all existing plans status to ARCHIVED except free-sakhi and premium-sakhi
  await prisma.plan.updateMany({
    where: {
      slug: { notIn: ['free-sakhi', 'premium-sakhi'] }
    },
    data: {
      status: 'ARCHIVED'
    }
  });

  // 1. Find or create Free Sakhi
  let freeSakhi = await prisma.plan.findFirst({
    where: { slug: 'free-sakhi' }
  });

  if (freeSakhi) {
    await prisma.plan.update({
      where: { id: freeSakhi.id },
      data: {
        name: 'Free Sakhi',
        price: 0,
        originalPrice: 0,
        interval: 'MONTHLY',
        status: 'ACTIVE'
      }
    });
  } else {
    freeSakhi = await prisma.plan.create({
      data: {
        name: 'Free Sakhi',
        slug: 'free-sakhi',
        price: 0,
        originalPrice: 0,
        interval: 'MONTHLY',
        status: 'ACTIVE'
      }
    });
  }

  // Update Free Sakhi Features
  await prisma.planFeature.deleteMany({ where: { planId: freeSakhi.id } });
  await prisma.planFeature.createMany({
    data: [
      { planId: freeSakhi.id, featureName: 'Duration', featureValue: '1 Month Free Trial' },
      { planId: freeSakhi.id, featureName: 'AI Sakhi Chat', featureValue: '5 chats / day' },
      { planId: freeSakhi.id, featureName: 'Books Library', featureValue: '5 Free Books' },
      { planId: freeSakhi.id, featureName: 'Community Access', featureValue: 'Basic Sisterhood Circle' },
      { planId: freeSakhi.id, featureName: 'Wellness Certificate', featureValue: 'Locked (Upgrade Required)' },
      { planId: freeSakhi.id, featureName: 'Short Description', featureValue: '1 Month Free Trial for all new sakhis.' }
    ]
  });

  // 2. Find or create Premium Sakhi
  let premiumSakhi = await prisma.plan.findFirst({
    where: { slug: 'premium-sakhi' }
  });

  if (!premiumSakhi) {
    // Try to reuse an existing active plan (like premium-pro or premium-plus) or create new
    const existing = await prisma.plan.findFirst({ where: { slug: { in: ['premium-pro', 'premium-plus'] } } });
    if (existing) {
      premiumSakhi = await prisma.plan.update({
        where: { id: existing.id },
        data: {
          name: 'Premium Sakhi',
          slug: 'premium-sakhi',
          price: 4999,
          originalPrice: 9999,
          interval: 'YEARLY',
          status: 'ACTIVE'
        }
      });
    } else {
      premiumSakhi = await prisma.plan.create({
        data: {
          name: 'Premium Sakhi',
          slug: 'premium-sakhi',
          price: 4999,
          originalPrice: 9999,
          interval: 'YEARLY',
          status: 'ACTIVE'
        }
      });
    }
  } else {
    premiumSakhi = await prisma.plan.update({
      where: { id: premiumSakhi.id },
      data: {
        name: 'Premium Sakhi',
        price: 4999,
        originalPrice: 9999,
        interval: 'YEARLY',
        status: 'ACTIVE'
      }
    });
  }

  // Update Premium Sakhi Features
  await prisma.planFeature.deleteMany({ where: { planId: premiumSakhi.id } });
  await prisma.planFeature.createMany({
    data: [
      { planId: premiumSakhi.id, featureName: 'Duration', featureValue: '1 Year Unlimited' },
      { planId: premiumSakhi.id, featureName: 'AI Sakhi Chat', featureValue: 'Unlimited 24/7 AI Chat' },
      { planId: premiumSakhi.id, featureName: 'Books Library', featureValue: 'Full Book & Audio Library Access' },
      { planId: premiumSakhi.id, featureName: 'Community Access', featureValue: 'Unlimited Sisterhood Circles' },
      { planId: premiumSakhi.id, featureName: 'Wellness Certificate', featureValue: 'Verified Certificate PDF Download' },
      { planId: premiumSakhi.id, featureName: 'Advisor Consultations', featureValue: '1 Consultation / Month' },
      { planId: premiumSakhi.id, featureName: 'Short Description', featureValue: '1 Year Unlimited access to Books, AI Chat, Community & Wellness Certificate.' }
    ]
  });

  console.log('Database plans successfully updated to ONLY 2 active plans!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
