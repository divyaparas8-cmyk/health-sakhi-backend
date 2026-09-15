const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up blocked related YouTube videos...");

  // 1. Delete youtubeVideos that are known to block embedding
  const deletedYt = await prisma.youtubeVideo.deleteMany({
    where: {
      OR: [
        { channelTitle: { contains: "TED-Ed" } },
        { channelTitle: { contains: "Osmosis" } },
        { channelTitle: { contains: "TEDx" } },
        { youtubeId: "RU38S_1R-U8" },
        { youtubeId: "t3wX5G-w28E" },
        { youtubeId: "J_Vv9w1b18g" },
        { youtubeId: "QJm-48rC-E8" },
        { youtubeId: "y6yE7QG1y58" },
        { youtubeId: "tEmt1MP_Zsk" }
      ]
    }
  });
  console.log(`Deleted ${deletedYt.count} blocked YouTube videos from database.`);

  // 2. Update ContentAsset records (baseline playlist videos) to use valid, embeddable YouTube links
  const updates = [
    {
      title: "Estrogen & Progesterone 101",
      mediaUrl: "https://www.youtube.com/embed/kS1G0m_j0jY" // Female Reproductive System - Armando Hasudungan
    },
    {
      title: "Thyroid Health in Women",
      mediaUrl: "https://www.youtube.com/embed/0G6L35n96uI" // Thyroid health guide
    },
    {
      title: "The Four Phases Explained",
      mediaUrl: "https://www.youtube.com/embed/tOlu1Zadgkc" // Menstrual cycle phases
    },
    {
      title: "Natural PMS Relief",
      mediaUrl: "https://www.youtube.com/embed/2-J53-p7Y2M" // PMS relief yoga / exercises
    },
    {
      title: "5-Minute SOS Breathwork",
      mediaUrl: "https://www.youtube.com/embed/tybOi4hjZFQ" // Box breathing
    }
  ];

  for (const item of updates) {
    const res = await prisma.contentAsset.updateMany({
      where: {
        title: item.title,
        type: "Video"
      },
      data: {
        mediaUrl: item.mediaUrl
      }
    });
    console.log(`Updated ${res.count} records for content asset: ${item.title}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
