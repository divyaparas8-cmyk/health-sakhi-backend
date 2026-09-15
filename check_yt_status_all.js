const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

async function checkOembed(id) {
  return new Promise((resolve) => {
    https.get('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + id + '&format=json', (res) => {
      resolve(res.statusCode);
    }).on('error', () => resolve(500));
  });
}

async function run() {
  const assets = await prisma.youtubeVideo.findMany();
  let unavailableIds = [];
  
  console.log('Checking ' + assets.length + ' YoutubeVideo records...');
  const promises = assets.map(async (asset) => {
    const status = await checkOembed(asset.youtubeId);
    if (status !== 200) {
      console.log('Video Unavailable:', asset.title, 'Status:', status);
      return asset.id;
    }
    return null;
  });

  const results = await Promise.all(promises);
  unavailableIds = results.filter(id => id !== null);

  console.log('Unavailable YoutubeVideo IDs count:', unavailableIds.length);
  
  if (unavailableIds.length > 0) {
    console.log('Deleting unavailable youtube videos...');
    await prisma.youtubeVideo.deleteMany({
      where: { id: { in: unavailableIds } }
    });
    console.log('Deleted successfully.');
  }

  // Also check ContentAsset table just in case!
  const contentAssets = await prisma.contentAsset.findMany({ where: { type: 'Video' } });
  let unavailableAssetIds = [];
  console.log('Checking ' + contentAssets.length + ' ContentAsset records...');
  
  for (const asset of contentAssets) {
    if (asset.mediaUrl && asset.mediaUrl.includes('youtube.com/embed/')) {
      const videoId = asset.mediaUrl.split('embed/')[1].split('?')[0];
      const status = await checkOembed(videoId);
      if (status !== 200) {
        console.log('ContentAsset Video Unavailable:', asset.title, 'Status:', status);
        unavailableAssetIds.push(asset.id);
      }
    }
  }
  
  console.log('Unavailable ContentAsset IDs count:', unavailableAssetIds.length);
  if (unavailableAssetIds.length > 0) {
    console.log('Deleting unavailable content assets...');
    await prisma.contentAsset.deleteMany({
      where: { id: { in: unavailableAssetIds } }
    });
    console.log('Deleted successfully.');
  }
  
  await prisma.$disconnect();
}

run();
