const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const translator = require('./src/utils/translator');

async function main() {
  const plans = await prisma.plan.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    include: { features: true }
  });

  const payload = {
    success: true,
    plans: plans.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
      interval: p.interval,
      features: p.features.map(f => ({ name: f.featureName, value: f.featureValue }))
    }))
  };

  console.log('--- BEFORE TRANSLATION ---');
  console.log(JSON.stringify(payload.plans[0], null, 2));

  console.log('Translating to Marathi (mr)...');
  const translated = await translator.translateDeep(payload, 'mr');

  console.log('--- AFTER TRANSLATION ---');
  console.log(JSON.stringify(translated.plans[0], null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
