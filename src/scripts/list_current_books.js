const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const assets = await prisma.contentAsset.findMany({
    where: { type: 'Book', status: 'Published' },
    select: { id: true, title: true, groupKey: true, mediaUrl: true, description: true }
  });
  console.log(`TOTAL PUBLISHED BOOKS IN DB: ${assets.length}`);
  assets.forEach((a, i) => {
    let cover = '';
    if (a.description && a.description.includes('[hs_cover]')) {
      cover = a.description.split('[hs_cover]')[1].split('[hs_chapters]')[0].split('[hs_access]')[0].trim();
    }
    console.log(`${i+1}. [${a.id}] "${a.title}" | mediaUrl: "${a.mediaUrl}" | hs_cover: "${cover}"`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
