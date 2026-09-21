const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const imagekit = require('../config/imagekit');
const prisma = new PrismaClient();

const ROOT_DIR = path.resolve(__dirname, '../../../');
const PUBLIC_IMAGES_DIR = path.resolve(__dirname, '../../../frontenhealth/public/Images');
const FRONTEND_BOOKS_DIR = path.resolve(__dirname, '../../../frontenhealth/public/books');

// The 14 images provided by the user
const IMAGES_TO_UPLOAD = [
  '1784961620784-heart_to_heart_yCA8shxlU.jpeg',
  '1784977598100-HS_LIFE_AFTRE_SHAADI_COVER__gHktWuOO.png',
  '1784978486052-final_cover_loneliness_EHE93QQNW.png',
  '1784979184252-final_cover_beauty_without_parlour_uLnKjgASX.png',
  'cover - heart to heart.png',
  'final cover beauty without parlour.png',
  'final cover fountain of family.png',
  'final pcod book cover.png',
  'final wt loss book cover.png',
  'heart to heart.png',
  'HOW TO READ WOMAN LIKE A POEM.png',
  'HS HOW TO READ HUSBAND COVE R.png',
  'HS LIFE AFTRE SHAADI COVER.png',
  'HS MENOPAUSE.png'
];

async function uploadFileToImageKit(fileName) {
  const filePath = path.join(ROOT_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return null;
  }

  // Also ensure it is in public/Images
  const publicDest = path.join(PUBLIC_IMAGES_DIR, fileName);
  try {
    fs.copyFileSync(filePath, publicDest);
  } catch (e) {}

  const fileBuffer = fs.readFileSync(filePath);
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  return new Promise((resolve) => {
    imagekit.upload({
      file: fileBuffer,
      fileName: cleanName,
      folder: '/healthsakhi_book_covers',
      useUniqueFileName: false
    }, (err, result) => {
      if (err) {
        console.error(`Failed to upload ${fileName} to ImageKit:`, err.message);
        resolve(null);
      } else {
        console.log(`Uploaded ${fileName} -> ${result.url}`);
        resolve(result.url);
      }
    });
  });
}

// Exact Book to Cover Mapping
const BOOK_COVER_MAP = {
  // Beauty Without Parlour
  'cec41b03-893e-4340-88be-6ea15c664d89': 'final cover beauty without parlour.png',
  
  // Child Development from 2 to 10 Years
  '2c0108c0-2d67-4dcb-9add-fcbf608b5d8e': 'final cover fountain of family.png',
  
  // Emotional Wisdom for Gen Z
  '51b4c39a-c5b6-4f3a-8c99-98909f6eb23d': 'HOW TO READ WOMAN LIKE A POEM.png',
  
  // Mother Nature and Daughter's Cycles
  '43c0b8ef-0092-4943-8c71-162f992a2284': 'HS MENOPAUSE.png',
  
  // Heart To Heart: For Every Woman of the World
  '77b9e21b-9c7e-4af0-a110-12e74bd83df4': 'heart to heart.png',
  
  // Letters to Daughters Before Memory Fades
  '07411b28-fc8d-431a-82cd-d1796cb53ca0': 'HOW TO READ WOMAN LIKE A POEM.png',
  
  // Husbands Heart Health
  '9afad1ae-931e-416f-bafe-e1e955962d13': 'HS HOW TO READ HUSBAND COVE R.png',
  
  // Life After Shaadi: Where Love Learns to Live
  'a4a22f41-4fe2-450e-9ecc-0547daac59e4': 'HS LIFE AFTRE SHAADI COVER.png',
  
  // Loneliness: Blessing in Disguise
  '11bc5efb-2b78-4ceb-af60-c0448eeff94c': '1784978486052-final_cover_loneliness_EHE93QQNW.png',
  
  // Potter's Secret to Parenting
  '68538959-90e1-4ea4-bc61-12f66d5bf912': 'final cover fountain of family.png',
  
  // Tired of Weight Loss: 100 Letters to Your Body
  '5c6ae705-4723-495c-b259-99515cb89239': 'final wt loss book cover.png',
  
  // Women's Hormones Made Simple
  'd36ab681-7799-4c03-a824-2f7bd88477bf': 'final pcod book cover.png'
};

async function main() {
  console.log('--- Step 1: Uploading user-provided covers to ImageKit CDN ---');
  const uploadedUrls = {};

  for (const fileName of IMAGES_TO_UPLOAD) {
    const url = await uploadFileToImageKit(fileName);
    if (url) {
      uploadedUrls[fileName] = url;
    }
  }

  console.log('\n--- Step 2: Updating Database ContentAsset records with CDN covers ---');
  for (const [bookId, fileName] of Object.entries(BOOK_COVER_MAP)) {
    const cdnUrl = uploadedUrls[fileName] || `/Images/${fileName}`;

    const asset = await prisma.contentAsset.findUnique({ where: { id: bookId } });
    if (!asset) {
      console.warn(`Book ID ${bookId} not found in DB!`);
      continue;
    }

    let desc = asset.description || '';
    // Replace or insert [hs_cover] tag
    if (desc.includes('[hs_cover]')) {
      const before = desc.split('[hs_cover]')[0];
      const afterPart = desc.split('[hs_cover]')[1];
      const rest = afterPart.includes('[hs_chapters]')
        ? '[hs_chapters]' + afterPart.split('[hs_chapters]')[1]
        : (afterPart.includes('[hs_access]') ? '[hs_access]' + afterPart.split('[hs_access]')[1] : '');
      desc = `${before.trim()} [hs_cover] ${cdnUrl} ${rest}`.trim();
    } else {
      desc = `${desc.trim()} [hs_cover] ${cdnUrl} [hs_access] Free`.trim();
    }

    await prisma.contentAsset.update({
      where: { id: bookId },
      data: {
        description: desc
      }
    });

    console.log(`Updated DB book "${asset.title}" (${bookId}) -> cover: ${cdnUrl}`);

    // Step 3: Update local JSON files in frontenhealth/public/books/
    const jsonPath = path.join(FRONTEND_BOOKS_DIR, `book_${bookId}_en.json`);
    if (fs.existsSync(jsonPath)) {
      try {
        const bookJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        bookJson.coverUrl = cdnUrl;
        bookJson.image = cdnUrl;
        fs.writeFileSync(jsonPath, JSON.stringify(bookJson, null, 2));
      } catch (e) {}
    }
  }

  // Step 4: Update books_list.json
  const listJsonPath = path.join(FRONTEND_BOOKS_DIR, 'books_list.json');
  if (fs.existsSync(listJsonPath)) {
    try {
      const list = JSON.parse(fs.readFileSync(listJsonPath, 'utf8'));
      list.forEach(b => {
        if (BOOK_COVER_MAP[b.id]) {
          const fn = BOOK_COVER_MAP[b.id];
          const cdnUrl = uploadedUrls[fn] || `/Images/${fn}`;
          b.coverUrl = cdnUrl;
          b.image = cdnUrl;
        }
      });
      fs.writeFileSync(listJsonPath, JSON.stringify(list, null, 2));
      console.log('Updated books_list.json with new cover URLs!');
    } catch (e) {}
  }

  console.log('\n--- ALL BOOK COVERS SUCCESSFULLY UPDATED! ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
