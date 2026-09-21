const fs = require('fs');
const path = require('path');
const imagekit = require('../config/imagekit');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const img1Src = 'C:/Users/Kiaan technology/.gemini/antigravity-ide/brain/72b772ec-e765-4dcc-9f9b-60c45d4becab/letters_to_daughters_cover_1789690152746.jpg';
const img2Src = 'C:/Users/Kiaan technology/.gemini/antigravity-ide/brain/72b772ec-e765-4dcc-9f9b-60c45d4becab/emotional_wisdom_genz_cover_1789690179737.jpg';

const publicDest1 = path.resolve(__dirname, '../../../frontenhealth/public/Images/letters_to_daughters_cover.jpg');
const publicDest2 = path.resolve(__dirname, '../../../frontenhealth/public/Images/emotional_wisdom_genz_cover.jpg');

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
  const url1 = await upload(img1Src, 'letters_to_daughters_cover.jpg') || '/Images/letters_to_daughters_cover.jpg';
  const url2 = await upload(img2Src, 'emotional_wisdom_genz_cover.jpg') || '/Images/emotional_wisdom_genz_cover.jpg';

  console.log('Final URL 1 (Letters to Daughters):', url1);
  console.log('Final URL 2 (Emotional Wisdom Gen Z):', url2);

  // Update DB Book 1: Letters to Daughters Before Memory Fades
  const b1 = await prisma.contentAsset.findUnique({ where: { id: '07411b28-fc8d-431a-82cd-d1796cb53ca0' } });
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
    console.log('Updated DB book 1: Letters to Daughters Before Memory Fades');
  }

  // Update DB Book 2: Emotional Wisdom for Gen Z
  const b2 = await prisma.contentAsset.findUnique({ where: { id: '51b4c39a-c5b6-4f3a-8c99-98909f6eb23d' } });
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
    console.log('Updated DB book 2: Emotional Wisdom for Gen Z');
  }

  // Update public books_list.json
  const listPath = path.resolve(__dirname, '../../../frontenhealth/public/books/books_list.json');
  if (fs.existsSync(listPath)) {
    const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    list.forEach(item => {
      if (item.id === '07411b28-fc8d-431a-82cd-d1796cb53ca0') {
        item.coverUrl = url1;
        item.image = url1;
      }
      if (item.id === '51b4c39a-c5b6-4f3a-8c99-98909f6eb23d') {
        item.coverUrl = url2;
        item.image = url2;
      }
    });
    fs.writeFileSync(listPath, JSON.stringify(list, null, 2));
    console.log('Updated frontenhealth/public/books/books_list.json');
  }

  // Update book detail JSONs if existing
  const b1Json = path.resolve(__dirname, '../../../frontenhealth/public/books/book_07411b28-fc8d-431a-82cd-d1796cb53ca0_en.json');
  if (fs.existsSync(b1Json)) {
    const j1 = JSON.parse(fs.readFileSync(b1Json, 'utf8'));
    j1.coverUrl = url1;
    j1.image = url1;
    fs.writeFileSync(b1Json, JSON.stringify(j1, null, 2));
    console.log('Updated book_07411b28-fc8d-431a-82cd-d1796cb53ca0_en.json');
  }
  const b2Json = path.resolve(__dirname, '../../../frontenhealth/public/books/book_51b4c39a-c5b6-4f3a-8c99-98909f6eb23d_en.json');
  if (fs.existsSync(b2Json)) {
    const j2 = JSON.parse(fs.readFileSync(b2Json, 'utf8'));
    j2.coverUrl = url2;
    j2.image = url2;
    fs.writeFileSync(b2Json, JSON.stringify(j2, null, 2));
    console.log('Updated book_51b4c39a-c5b6-4f3a-8c99-98909f6eb23d_en.json');
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
