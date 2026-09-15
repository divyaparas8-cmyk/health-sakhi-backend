const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Seed Roles
  const roles = [
    { name: 'Admin', description: 'Administrator with full access' },
    { name: 'Member', description: 'Standard platform member' },
    { name: 'Advisor', description: 'Professional advisor / consultant' },
    { name: 'Affiliate', description: 'Affiliate partner for referral programs' },
  ];

  console.log('Seeding roles...');
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
  }

  // Seed Plans
  console.log('Seeding plans...');
  
  // 1. Free Sakhi Plan
  let freeSakhi = await prisma.plan.findFirst({
    where: { slug: 'free-sakhi', deletedAt: null }
  });
  if (!freeSakhi) {
    freeSakhi = await prisma.plan.create({
      data: {
        name: 'Free Sakhi',
        slug: 'free-sakhi',
        price: 0.00,
        interval: 'MONTHLY',
        status: 'ACTIVE',
        maxAiChatsPerDay: 5,
        advisorCredits: 0,
      }
    });
  } else {
    freeSakhi = await prisma.plan.update({
      where: { id: freeSakhi.id },
      data: {
        name: 'Free Sakhi',
        price: 0.00,
        interval: 'MONTHLY',
        status: 'ACTIVE',
        maxAiChatsPerDay: 5,
        advisorCredits: 0,
      }
    });
  }

  // Free Sakhi Features
  await prisma.planFeature.deleteMany({ where: { planId: freeSakhi.id } });
  await prisma.planFeature.createMany({
    data: [
      { planId: freeSakhi.id, featureName: 'AI Chat Limit', featureValue: '5 messages/day' },
      { planId: freeSakhi.id, featureName: 'Advisor Consultations', featureValue: 'disabled' },
    ]
  });

  // 2. Basic Sakhi Plan (₹699/month) - AI Chat, All Books, Wellness Certificate
  let basicSakhi = await prisma.plan.findFirst({
    where: { slug: 'basic-sakhi', deletedAt: null }
  });
  if (!basicSakhi) {
    basicSakhi = await prisma.plan.create({
      data: {
        name: 'Basic Sakhi',
        slug: 'basic-sakhi',
        price: 699.00,
        interval: 'MONTHLY',
        status: 'ACTIVE',
        maxAiChatsPerDay: 999999,
        advisorCredits: 0,
      }
    });
  } else {
    basicSakhi = await prisma.plan.update({
      where: { id: basicSakhi.id },
      data: {
        name: 'Basic Sakhi',
        price: 699.00,
        interval: 'MONTHLY',
        status: 'ACTIVE',
        maxAiChatsPerDay: 999999,
        advisorCredits: 0,
      }
    });
  }

  // Basic Sakhi Features
  await prisma.planFeature.deleteMany({ where: { planId: basicSakhi.id } });
  await prisma.planFeature.createMany({
    data: [
      { planId: basicSakhi.id, featureName: 'Books Access', featureValue: 'Unlimited' },
      { planId: basicSakhi.id, featureName: 'AI Chat Bot', featureValue: 'Enabled' },
      { planId: basicSakhi.id, featureName: 'Wellness Certificate', featureValue: 'Enabled' },
      { planId: basicSakhi.id, featureName: 'Partner Sakhi', featureValue: 'Locked' },
      { planId: basicSakhi.id, featureName: 'Ask Health Sakhi', featureValue: 'Locked' },
    ]
  });

  // 3. Premium Sakhi Plan (₹999/month) - Everything Unlimited
  let premiumSakhi = await prisma.plan.findFirst({
    where: { slug: 'premium-sakhi', deletedAt: null }
  });
  if (!premiumSakhi) {
    premiumSakhi = await prisma.plan.create({
      data: {
        name: 'Premium Sakhi',
        slug: 'premium-sakhi',
        price: 999.00,
        interval: 'MONTHLY',
        status: 'ACTIVE',
        maxAiChatsPerDay: 999999,
        advisorCredits: 3,
      }
    });
  } else {
    premiumSakhi = await prisma.plan.update({
      where: { id: premiumSakhi.id },
      data: {
        name: 'Premium Sakhi',
        price: 999.00,
        interval: 'MONTHLY',
        status: 'ACTIVE',
        maxAiChatsPerDay: 999999,
        advisorCredits: 3,
      }
    });
  }

  // Premium Sakhi Features
  await prisma.planFeature.deleteMany({ where: { planId: premiumSakhi.id } });
  await prisma.planFeature.createMany({
    data: [
      { planId: premiumSakhi.id, featureName: 'Books Access', featureValue: 'Unlimited' },
      { planId: premiumSakhi.id, featureName: 'AI Chat Bot', featureValue: 'Enabled' },
      { planId: premiumSakhi.id, featureName: 'Wellness Certificate', featureValue: 'Enabled' },
      { planId: premiumSakhi.id, featureName: 'Partner Sakhi', featureValue: 'Enabled' },
      { planId: premiumSakhi.id, featureName: 'Ask Health Sakhi', featureValue: 'Enabled' },
      { planId: premiumSakhi.id, featureName: 'Advisor Sessions', featureValue: '3 per month' },
    ]
  });

  // 4. Premium Pro (legacy plan - keep for backward compatibility)
  let premiumPro = await prisma.plan.findFirst({
    where: { slug: 'premium-pro', deletedAt: null }
  });
  if (!premiumPro) {
    premiumPro = await prisma.plan.create({
      data: {
        name: 'Premium Pro',
        slug: 'premium-pro',
        price: 9.99,
        interval: 'MONTHLY',
        status: 'ACTIVE',
        maxAiChatsPerDay: 999999,
        advisorCredits: 1,
      }
    });
  } else {
    premiumPro = await prisma.plan.update({
      where: { id: premiumPro.id },
      data: {
        name: 'Premium Pro',
        price: 9.99,
        interval: 'MONTHLY',
        status: 'ACTIVE',
        maxAiChatsPerDay: 999999,
        advisorCredits: 1,
      }
    });
  }

  // Premium Pro Features
  await prisma.planFeature.deleteMany({ where: { planId: premiumPro.id } });
  await prisma.planFeature.createMany({
    data: [
      { planId: premiumPro.id, featureName: 'AI Chat Limit', featureValue: 'unlimited' },
      { planId: premiumPro.id, featureName: 'Advisor Consultations', featureValue: 'enabled' },
    ]
  });

  // 5. Elite Plan (legacy plan - keep for backward compatibility)
  let elite = await prisma.plan.findFirst({
    where: { slug: 'elite', deletedAt: null }
  });
  if (!elite) {
    elite = await prisma.plan.create({
      data: {
        name: 'Elite',
        slug: 'elite',
        price: 49.99,
        interval: 'MONTHLY',
        status: 'ACTIVE',
        maxAiChatsPerDay: 999999,
        advisorCredits: 5,
      }
    });
  } else {
    elite = await prisma.plan.update({
      where: { id: elite.id },
      data: {
        name: 'Elite',
        price: 49.99,
        interval: 'MONTHLY',
        status: 'ACTIVE',
        maxAiChatsPerDay: 999999,
        advisorCredits: 5,
      }
    });
  }

  // Elite Features
  await prisma.planFeature.deleteMany({ where: { planId: elite.id } });
  await prisma.planFeature.createMany({
    data: [
      { planId: elite.id, featureName: 'AI Chat Limit', featureValue: 'unlimited' },
      { planId: elite.id, featureName: 'Advisor Consultations', featureValue: 'enabled' },
    ]
  });

  // Seed Demo Users (Admin, Advisor, Affiliate/Partner, Member)
  console.log('Seeding demo users...');

  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
  const memberRole = await prisma.role.findUnique({ where: { name: 'Member' } });
  const advisorRole = await prisma.role.findUnique({ where: { name: 'Advisor' } });
  const affiliateRole = await prisma.role.findUnique({ where: { name: 'Affiliate' } });

  const demoUsers = [
    { email: 'admin@healthsakhi.in', roleId: adminRole.id, fullName: 'Admin User', password: 'admin123' },
    { email: 'advisor@healthsakhi.in', roleId: advisorRole.id, fullName: 'Dr. Sakshi Sharma', password: 'advisor123' },
    { email: 'partner@healthsakhi.in', roleId: affiliateRole.id, fullName: 'Sakhi Partner', password: 'partner123' },
    { email: 'member@gmail.com', roleId: memberRole.id, fullName: 'HealthSakhi Priya', password: 'member123' },
  ];

  for (const demo of demoUsers) {
    let user = await prisma.user.findFirst({
      where: { email: demo.email, deletedAt: null }
    });

    const hashedPass = require('crypto').createHash('sha256').update(demo.password).digest('hex');

    if (user) {
      // Update role and password if it doesn't match
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId: demo.roleId, passwordHash: hashedPass }
      });
      console.log(`  Updated role and password for ${demo.email}`);
    } else {
      user = await prisma.user.create({
        data: {
          email: demo.email,
          passwordHash: hashedPass,
          roleId: demo.roleId,
          isApproved: true,
          isSuspended: false,
          profile: {
            create: {
              fullName: demo.fullName,
              streakCount: 0,
              wellnessScore: 0,
              lastActiveDate: new Date()
            }
          }
        }
      });
      console.log(`  Created demo user: ${demo.email}`);
    }

    // If this is the advisor, ensure Advisor profile is created
    if (demo.email === 'advisor@healthsakhi.in') {
      const existingAdvisor = await prisma.advisor.findFirst({
        where: { userId: user.id }
      });
      if (!existingAdvisor) {
        await prisma.advisor.create({
          data: {
            userId: user.id,
            bio: 'Experienced general physician & women health expert',
            photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
            qualification: 'MBBS, MD - Obstetrics & Gynecology',
            status: 'approved',
            hourlyRate: 150.00,
            rating: 4.8,
            totalReviews: 12,
            specializations: {
              create: [
                { specializationName: 'Gynecology' },
                { specializationName: 'Women Health' }
              ]
            }
          }
        });
        console.log('  Created Advisor profile and specializations for advisor@healthsakhi.in');
      } else {
        // Ensure status is approved
        await prisma.advisor.update({
          where: { id: existingAdvisor.id },
          data: { status: 'approved' }
        });
        console.log('  Advisor profile already exists for advisor@healthsakhi.in');
      }
    }
  }

  // Seed Community Circles
  console.log('Seeding community circles...');
  const communityCircles = [
    { name: 'PCOD Support', description: 'Discuss PCOD management and healing in a safe space.', icon: 'Heart', color: '#ff69b4' },
    { name: 'Moms Circle', description: 'Connecting moms for emotional and physical wellbeing.', icon: 'Users', color: '#8b5cf6' },
    { name: 'Stress Support', description: 'Helping each other find calm in daily chaos.', icon: 'Shield', color: '#0ea5e9' },
    { name: 'Confidence', description: 'Empowering women to lead with inner strength.', icon: 'Star', color: '#f59e0b' }
  ];

  for (const c of communityCircles) {
    await prisma.communityCircle.upsert({
      where: { name: c.name },
      update: c,
      create: c
    });
  }

  // Seed Blogs
  console.log('Seeding blogs...');
  const defaultBlogs = [
    {
      title: 'Ayurvedic Habits for Morning Energy',
      desc: 'Start your day with small rituals that bring lasting energy and vitality.',
      category: 'Wellness',
      tag: 'Wellness',
      author: 'Dr. Sakshi',
      img: '/Images/ayurvedic.png',
      date: 'April 2026',
      content: `Ayurvedic habits bring lasting vitality. Start your morning with a glass of warm water, gentle breathing exercises, and mindful reflections to harmonize your inner energy.

Key Daily Morning Practices:
1. Drink Warm Water: Flushes toxins and stimulates digestive agni.
2. Pranayama & Gentle Stretch: 10 minutes of deep breathwork balances mind & nervous system.
3. Mindful Reflection: Gratitude journaling creates emotional resilience for the entire day.`
    },
    {
      title: 'The Silent Impact of Stress on Hormones',
      desc: 'Understand how daily stress shapes your body, mind, and emotional wellbeing.',
      category: 'Health',
      tag: 'Health',
      author: 'Dr. Pratap',
      img: '/Images/silent.png',
      pdfUrl: 'https://ik.imagekit.io/pmvunscn5i/healthsakhi_content/sample_blog.pdf',
      date: 'April 2026',
      content: 'Stress affects cortisol levels and hormonal harmony. Practicing short meditation breaks and evening digital detox helps maintain emotional and physical balance.'
    }
  ];

  for (const b of defaultBlogs) {
    const existingBlog = await prisma.blog.findFirst({
      where: { title: b.title }
    });
    if (!existingBlog) {
      await prisma.blog.create({
        data: b
      });
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
