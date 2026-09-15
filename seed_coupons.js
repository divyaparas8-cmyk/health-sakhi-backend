const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding subscription test coupons...');

  const coupons = [
    {
      code: 'WELCOME50',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      maxUsageTotal: 500,
      maxUsagePerUser: 1,
      minOrderAmount: 0,
      applicablePlan: null,
      expiresAt: new Date('2027-12-31'),
      isActive: true
    },
    {
      code: 'FLAT100',
      discountType: 'FLAT',
      discountValue: 100,
      maxUsageTotal: 200,
      maxUsagePerUser: 1,
      minOrderAmount: 199,
      applicablePlan: null,
      expiresAt: new Date('2027-12-31'),
      isActive: true
    },
    {
      code: 'PREMIUM20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxUsageTotal: 100,
      maxUsagePerUser: 1,
      minOrderAmount: 0,
      applicablePlan: 'premium-pro',
      expiresAt: new Date('2027-06-30'),
      isActive: true
    }
  ];

  for (const coupon of coupons) {
    const existing = await prisma.coupon.findUnique({ where: { code: coupon.code } });
    if (!existing) {
      await prisma.coupon.create({ data: coupon });
      console.log(`  ✅ Created coupon: ${coupon.code}`);
    } else {
      console.log(`  ⏭️  Coupon ${coupon.code} already exists`);
    }
  }

  console.log('Done seeding coupons!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
