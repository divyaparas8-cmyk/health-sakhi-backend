const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const assets = await prisma.contentAsset.findMany({
    where: { type: 'Video' }
  });
  console.log('--- CONTENT ASSETS (Video) ---');
  assets.forEach(a => {
    console.log(`${a.title} ===> ${a.mediaUrl}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
