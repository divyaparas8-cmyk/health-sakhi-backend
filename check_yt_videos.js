const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const counts = await prisma.youtubeVideo.groupBy({
    by: ['keyword'],
    _count: {
      id: true
    }
  });
  console.log('--- YOUTUBE VIDEOS BY KEYWORD ---');
  console.log(JSON.stringify(counts, null, 2));

  const sample = await prisma.youtubeVideo.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log('\n--- 5 RECENT VIDEOS ---');
  sample.forEach(v => {
    console.log(`Title: ${v.title}`);
    console.log(`  Keyword: ${v.keyword}`);
    console.log(`  YoutubeId: ${v.youtubeId}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
