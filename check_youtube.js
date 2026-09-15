require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  try {
    const count = await p.youtubeVideo.count();
    console.log('✅ Total youtube_videos in DB:', count);
    if (count > 0) {
      const sample = await p.youtubeVideo.findFirst({ orderBy: { createdAt: 'desc' } });
      console.log('📹 Latest video:', sample.title);
    }
  } catch (err) {
    console.error('❌ ERROR:', err.message);
  } finally {
    await p.$disconnect();
  }
}
check();
