const fs = require('fs');
const path = require('path');
const imagekit = require('../config/imagekit');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const img1Src = 'C:/Users/Kiaan technology/.gemini/antigravity-ide/brain/72b772ec-e765-4dcc-9f9b-60c45d4becab/when_soul_talks_to_mind_cover_1789690994910.jpg';
const img2Src = 'C:/Users/Kiaan technology/.gemini/antigravity-ide/brain/72b772ec-e765-4dcc-9f9b-60c45d4becab/husbands_heart_health_cover_1789691042728.jpg';

const publicDest1 = path.resolve(__dirname, '../../../frontenhealth/public/Images/when_soul_talks_to_mind_cover.jpg');
const publicDest2 = path.resolve(__dirname, '../../../frontenhealth/public/Images/husbands_heart_health_cover.jpg');

try {
  fs.copyFileSync(img1Src, publicDest1);
  fs.copyFileSync(img2Src, publicDest2);
  console.log('Copied images to frontenhealth/public/Images');
} catch (e) {
  console.error('Copy error:', e.message);
}

async function upload(filePath, fileName) {
  const buf = fs.readFileSync(filePath);
  return new Promise((resolve) => {
    imagekit.upload({
      file: buf,
      fileName: fileName,
      folder: '/healthsakhi_book_covers',
      useUniqueFileName: false
    }, (err, res) => {
      if (err) {
        console.error('Upload err:', err);
        resolve(null);
      } else {
        console.log('Uploaded successfully to ImageKit:', res.url);
        resolve(res.url);
      }
    });
  });
}

async function run() {
  const url1 = await upload(img1Src, 'when_soul_talks_to_mind_cover.jpg') || '/Images/when_soul_talks_to_mind_cover.jpg';
  const url2 = await upload(img2Src, 'husbands_heart_health_cover.jpg') || '/Images/husbands_heart_health_cover.jpg';

  console.log('Final URL 1 (When Soul Talks to Mind):', url1);
  console.log('Final URL 2 (Husbands Heart Health):', url2);

  // Update DB Book 1: WHEN SOUL TALK TO MIND
  const b1 = await prisma.contentAsset.findUnique({ where: { id: '2eb65caf-3e42-4bc5-b9e3-7f112ff6acca' } });
  if (b1) {
    let desc = b1.description || '';
    const before = desc.split('[hs_cover]')[0];
    const afterPart = desc.includes('[hs_cover]') ? desc.split('[hs_cover]')[1] : '';
    const rest = afterPart.includes('[hs_chapters]') ? '[hs_chapters]' + afterPart.split('[hs_chapters]')[1] : (afterPart.includes('[hs_access]') ? '[hs_access]' + afterPart.split('[hs_access]')[1] : '');
    desc = `${before.trim()} [hs_cover] ${url1} ${rest}`.trim();
    await prisma.contentAsset.update({
      where: { id: b1.id },
      data: { description: desc }
    });
    console.log('Updated DB book 1: WHEN SOUL TALK TO MIND');
  }

  // Update DB Book 2: Husbands Heart Health
  const b2 = await prisma.contentAsset.findUnique({ where: { id: '9afad1ae-931e-416f-bafe-e1e955962d13' } });
  if (b2) {
    let desc = b2.description || '';
    const before = desc.split('[hs_cover]')[0];
    const afterPart = desc.includes('[hs_cover]') ? desc.split('[hs_cover]')[1] : '';
    const rest = afterPart.includes('[hs_chapters]') ? '[hs_chapters]' + afterPart.split('[hs_chapters]')[1] : (afterPart.includes('[hs_access]') ? '[hs_access]' + afterPart.split('[hs_access]')[1] : '');
    desc = `${before.trim()} [hs_cover] ${url2} ${rest}`.trim();
    await prisma.contentAsset.update({
      where: { id: b2.id },
      data: { description: desc }
    });
    console.log('Updated DB book 2: Husbands Heart Health');
  }

  // Update public books_list.json
  const listPath = path.resolve(__dirname, '../../../frontenhealth/public/books/books_list.json');
  if (fs.existsSync(listPath)) {
    const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    list.forEach(item => {
      if (item.id === '2eb65caf-3e42-4bc5-b9e3-7f112ff6acca') {
        item.coverUrl = url1;
        item.image = url1;
      }
      if (item.id === '9afad1ae-931e-416f-bafe-e1e955962d13') {
        item.coverUrl = url2;
        item.image = url2;
      }
    });
    fs.writeFileSync(listPath, JSON.stringify(list, null, 2));
    console.log('Updated frontenhealth/public/books/books_list.json');
  }

  // Update book detail JSONs if existing
  const b1Json = path.resolve(__dirname, '../../../frontenhealth/public/books/book_2eb65caf-3e42-4bc5-b9e3-7f112ff6acca_en.json');
  if (fs.existsSync(b1Json)) {
    const j1 = JSON.parse(fs.readFileSync(b1Json, 'utf8'));
    j1.coverUrl = url1;
    j1.image = url1;
    fs.writeFileSync(b1Json, JSON.stringify(j1, null, 2));
    console.log('Updated book_2eb65caf-3e42-4bc5-b9e3-7f112ff6acca_en.json');
  }
  const b2Json = path.resolve(__dirname, '../../../frontenhealth/public/books/book_9afad1ae-931e-416f-bafe-e1e955962d13_en.json');
  if (fs.existsSync(b2Json)) {
    const j2 = JSON.parse(fs.readFileSync(b2Json, 'utf8'));
    j2.coverUrl = url2;
    j2.image = url2;
    fs.writeFileSync(b2Json, JSON.stringify(j2, null, 2));
    console.log('Updated book_9afad1ae-931e-416f-bafe-e1e955962d13_en.json');
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
