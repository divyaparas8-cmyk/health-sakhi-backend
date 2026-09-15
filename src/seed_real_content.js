const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning database...");
  // Clear any existing progress records to avoid constraints
  const progressCount = await prisma.userContentProgress.deleteMany({});
  console.log(`Deleted ${progressCount.count} progress records.`);
  
  // Clear existing content assets
  const assetCount = await prisma.contentAsset.deleteMany({});
  console.log(`Deleted ${assetCount.count} content assets.`);

  console.log("Seeding real content...");
  
  // 1. Seed Real Video
  const video = await prisma.contentAsset.create({
    data: {
      title: "Women Health & Cycle Mastery",
      type: "Video",
      category: "Women Health",
      status: "Published",
      mediaUrl: "/uploads/1781877374024-31993236.mp4",
      description: "An introductory session on estrogen, progesterone and mastering your hormonal cycles naturally."
    }
  });
  console.log(`Created Video Asset: ${video.title} (ID: ${video.id})`);

  // 2. Seed Real Book
  const book = await prisma.contentAsset.create({
    data: {
      title: "Mastering PCOS: A Practical Guide",
      type: "Book",
      category: "Women Health",
      status: "Published",
      mediaUrl: "/uploads/1781877491975-591436111.pdf",
      description: "A comprehensive guide on diet, nutrition, stress management, and lifestyle routines to heal and balance PCOS naturally."
    }
  });
  console.log(`Created Book Asset: ${book.title} (ID: ${book.id})`);

  console.log("Seeding finished successfully!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
