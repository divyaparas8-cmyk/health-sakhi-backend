const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const imagekit = require('../config/imagekit');

async function main() {
  console.log("Starting bulk upload of existing uploads to ImageKit CDN...");

  // Fetch all assets currently pointing to the local uploads directory
  const assets = await prisma.contentAsset.findMany({
    where: {
      mediaUrl: {
        contains: '/uploads/'
      }
    }
  });

  console.log(`Found ${assets.length} content assets with local /uploads/ URLs.`);

  const uploadsDir = path.join(__dirname, '../../uploads');

  for (const asset of assets) {
    const filename = path.basename(asset.mediaUrl);
    const filePath = path.join(uploadsDir, filename);

    console.log(`\nProcessing asset: "${asset.title}" (${asset.type})`);
    console.log(`- Local file: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.warn(`- WARNING: File does not exist at local path: ${filePath}. Skipping.`);
      continue;
    }

    try {
      console.log(`- Reading file buffer...`);
      const fileBuffer = fs.readFileSync(filePath);

      console.log(`- Uploading file to ImageKit...`);
      const uploadRes = await imagekit.upload({
        file: fileBuffer,
        fileName: filename,
        folder: '/healthsakhi_content'
      });

      console.log(`- Upload successful. Returned URL: ${uploadRes.url}`);
      
      console.log(`- Updating database record...`);
      await prisma.contentAsset.update({
        where: { id: asset.id },
        data: { mediaUrl: uploadRes.url }
      });
      console.log(`- Updated successfully.`);
    } catch (err) {
      console.error(`- ERROR uploading asset "${asset.title}":`, err.message);
    }
  }

  console.log("\nBulk upload migration finished.");
}

main()
  .catch(e => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
