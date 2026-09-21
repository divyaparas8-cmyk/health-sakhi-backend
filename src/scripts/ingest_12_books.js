const fs = require('fs');
const path = require('path');
const mammoth = require('../../../frontenhealth/node_modules/mammoth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const WORKSPACE_ROOT = path.resolve(__dirname, '../../../');
const FRONTEND_BOOKS_DIR = path.resolve(__dirname, '../../../frontenhealth/public/books');
const BACKEND_BOOKS_DIR = path.resolve(__dirname, '../data/library_books');

// Definitions for the 12 DOCX books
const BOOKS_CONFIG = [
  {
    docxFile: 'BeautyWithoutParlour_KDP_Final.docx',
    slug: 'beauty-without-parlour',
    dbMatchTitle: 'Beauty Without Parlour',
    title: 'Beauty Without Parlour',
    subtitle: 'Heal Inside. Glow Outside.',
    category: 'Women Health',
    author: 'Dr. Pratap Madhukar',
    coverUrl: '/Images/final cover beauty without parlour.png',
    desc: 'Natural Ayurvedic wellness, holistic skin nutrition, gut-skin connection, and hormone balancing secrets for lifelong beauty without parlour treatments.'
  },
  {
    docxFile: 'Child_Development_2_to_10_HealthSakhi_Expanded_KDP_6x9.docx',
    slug: 'child-development-2-to-10',
    dbMatchTitle: 'Child Development',
    title: 'Child Development from 2 to 10 Years',
    subtitle: 'A Simple Guide for Mothers',
    category: 'Relationships',
    author: 'HealthSakhi Expert',
    coverUrl: '/Images/child_dev_dummy.png',
    desc: 'Understanding child growth, emotional milestones, physical health, positive communication, and building lifelong resilience from ages 2 to 10.'
  },
  {
    docxFile: 'Emotional_Wisdom_GenZ_HealthSakhi_Clickable_Index.docx',
    slug: 'emotional-wisdom-for-gen-z',
    dbMatchTitle: 'Emotional Wisdom for Gen Z',
    title: 'Emotional Wisdom for Gen Z',
    subtitle: 'When Emotions Teach You',
    category: 'Mental Healing',
    author: 'Dr. Pratap Madhukar',
    coverUrl: '/Images/HOW TO READ WOMAN LIKE A POEM.png',
    desc: 'A modern guide for understanding, naming, and regulating emotions, managing anxiety, building self-worth, and navigating digital burnout.'
  },
  {
    docxFile: 'HealthSakhi_Mother_Nature_Daughters_Cycles.docx',
    slug: 'mother-nature-and-daughters-cycles',
    dbMatchTitle: 'Mother Nature and Daughters Cycles',
    title: "Mother Nature and Daughter's Cycles",
    subtitle: '50 Honest Stories for Girls and Women',
    category: 'Women Health',
    author: 'HealthSakhi Expert',
    coverUrl: '/Images/final cover - womens monthly wellness guide.png',
    desc: 'A compassionate, honest clinical and emotional guide on menstruation, hormonal rhythms, PMS, cravings, and cycle sync across every age.'
  },
  {
    docxFile: 'HeartToHeart_HealthSakhi.docx',
    slug: 'heart-to-heart',
    dbMatchTitle: 'Heart To Heart',
    title: 'Heart To Heart: For Every Woman of the World',
    subtitle: 'Inner Peace and Compassion',
    category: 'Heart Care',
    author: 'Dr. Pratap Madhukar',
    coverUrl: '/Images/heart to heart.png',
    desc: 'A warm, healing conversation on releasing emotional burdens, healing silent grief, and finding sanctuary within your heart.'
  },
  {
    docxFile: 'Letters to daughters before memory fades.docx',
    slug: 'letters-to-daughters',
    dbMatchTitle: 'Letters to daughters before memory fades',
    title: 'Letters to Daughters Before Memory Fades',
    subtitle: 'Parental Wisdom & Memory Care',
    category: 'Relationships',
    author: 'Dr. Pratap Madhukar',
    coverUrl: '/Images/Letters to daughter_demo.png',
    desc: 'Heartfelt letters exploring love, family memories, caring for aging parents, dementia awareness, and intergenerational emotional healing.'
  },
  {
    docxFile: 'husbands_heart_health_kdp_6x9_v2(1) (1).docx',
    slug: 'husbands-heart-health',
    dbMatchTitle: 'Husbands Heart Health',
    title: 'Husbands Heart Health',
    subtitle: 'Written for the King of Family Hearts',
    category: 'Heart Care',
    author: 'Dr. Pratap Madhukar',
    coverUrl: '/Images/cover -husbands heart health.png',
    desc: 'Essential cardiovascular prevention, blood pressure mastery, stress reduction, diet, and healthy lifestyle habits for men and family pillars.'
  },
  {
    docxFile: 'Life_After_Shaadi_HealthSakhi.docx',
    slug: 'life-after-shaadi',
    dbMatchTitle: 'Life After Shadi',
    title: 'Life After Shaadi: Where Love Learns to Live',
    subtitle: 'Stories of Real Marriage and Emotional Growth',
    category: 'Relationships',
    author: 'HealthSakhi Expert',
    coverUrl: '/Images/HS LIFE AFTRE SHAADI COVER.png',
    desc: 'Real stories of marriage, communication, intimacy, managing in-laws, resolving conflicts, and building mutual respect after marriage.'
  },
  {
    docxFile: 'Loneliness_Blessing_in_Disguise_HealthSakhi_KDP_6x9.docx',
    slug: 'loneliness-blessing-in-disguise',
    dbMatchTitle: 'Loneliness Blessing in Disguise',
    title: 'Loneliness: Blessing in Disguise',
    subtitle: 'Self-Connection, Belonging, and Peace',
    category: 'Mental Healing',
    author: 'HealthSakhi Expert',
    coverUrl: '/Images/final cover loneliness.png',
    desc: '100 Letters for the woman ready to heal loneliness, transform isolation into solitude, and nurture deep self-acceptance.'
  },
  {
    docxFile: 'potters secret to parenting.docx',
    slug: 'potters-secret-to-parenting',
    dbMatchTitle: "Potter's Secret to Parenting",
    title: "Potter's Secret to Parenting",
    subtitle: "Letters from Parent's Soul to Teenager's Soul",
    category: 'Relationships',
    author: 'Dr. Pratap Madhukar',
    coverUrl: '/Images/beyond parenting cover final potter.png',
    desc: '169 chapters guiding parents through adolescent psychology, emotional regulation, screen time, peer pressure, and building unbreakable trust.'
  },
  {
    docxFile: 'TiredOfWeightLoss_HealthSakhi_Clickable_Index.docx',
    slug: 'tired-of-weight-loss',
    dbMatchTitle: 'Tired of Weight Loss',
    title: 'Tired of Weight Loss: 100 Letters to Your Body',
    subtitle: 'Healing Through Food, Fasting, and Mindset',
    category: 'Cravings',
    author: 'Dr. Pratap Madhukar',
    coverUrl: '/Images/final wt loss book cover.png',
    desc: 'Stop fighting your body. A compassionate science-based guide to metabolic healing, emotional eating, intermittent fasting, and food freedom.'
  },
  {
    docxFile: 'Womens_Hormones_Made_Simple_HealthSakhi.docx',
    slug: 'womens-hormones-made-simple',
    dbMatchTitle: 'woman harmons',
    title: "Women's Hormones Made Simple",
    subtitle: 'A Step-by-Step Handbook for Ages 15 to 40',
    category: 'Women Health',
    author: 'Dr. Pratap Madhukar',
    coverUrl: '/Images/final pcod book cover.png',
    desc: '128 chapters demystifying estrogen, progesterone, thyroid, insulin, PCOS, acne, fertility, and mood swings without medical jargon.'
  }
];

function cleanHtmlText(text) {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parses a single DOCX file into structured chapters and paginated content.
 */
async function parseDocxBook(filePath, config) {
  console.log(`\n========================================`);
  console.log(`Processing: ${config.title}`);
  console.log(`File: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const res = await mammoth.convertToHtml({ path: filePath });
  const fullHtml = res.value;

  // Split HTML into paragraphs
  const rawParas = fullHtml
    .split(/<\/p>/i)
    .map(p => {
      let cleaned = p.replace(/^<p[^>]*>/i, '').trim();
      return cleaned;
    })
    .filter(Boolean);

  console.log(`Total paragraphs in DOCX: ${rawParas.length}`);

  // Build paginated content (~250-320 words per page)
  const pages = [];
  let currentPageParas = [];
  let currentWordCount = 0;

  for (let i = 0; i < rawParas.length; i++) {
    const p = rawParas[i];
    const text = cleanHtmlText(p);
    const words = text.split(/\s+/).filter(Boolean).length;

    // Check if paragraph explicitly breaks page or if word limit reached
    const isHeading = (
      /^(chapter\s+\d+|part\s+[ivx\d]+|letter\s+\d+|story\s+\d+)\s*[:—–-]/i.test(text) ||
      /^(\d+)\.\s+[A-Z]/i.test(text)
    ) && text.length < 120;

    if ((currentWordCount >= 280) || (currentWordCount >= 180 && isHeading)) {
      if (currentPageParas.length > 0) {
        pages.push(currentPageParas.map(cp => `<p>${cp}</p>`).join('\n'));
        currentPageParas = [];
        currentWordCount = 0;
      }
    }

    currentPageParas.push(p);
    currentWordCount += words;
  }

  if (currentPageParas.length > 0) {
    pages.push(currentPageParas.map(cp => `<p>${cp}</p>`).join('\n'));
  }

  console.log(`Generated ${pages.length} readable pages.`);

  // Detect chapters/topics throughout the book
  // Scan for chapter headings:
  const detectedChapters = [];
  const seenTitles = new Set();

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageHtml = pages[pageIdx];
    const pageParas = pageHtml.split(/<\/p>/i).map(p => p.replace(/^<p[^>]*>/i, '').trim()).filter(Boolean);

    for (let pIdx = 0; pIdx < pageParas.length; pIdx++) {
      const p = pageParas[pIdx];
      const text = cleanHtmlText(p);

      // Match headings:
      // "Chapter 1: ...", "Part 1: ...", "Letter 1: ...", "Story 1: ...", or "1. Title"
      const isChapterHeading = (
        /^(chapter\s+\d+|part\s+[ivx\d]+|letter\s+\d+|story\s+\d+)\s*[:—–-]/i.test(text) ||
        /^(\d+)\.\s+[A-Z0-9]/i.test(text)
      ) && text.length >= 4 && text.length <= 130 && !text.toLowerCase().includes('table of contents') && !text.toLowerCase().includes('index of all');

      if (isChapterHeading) {
        // Clean title
        let cleanTitle = text.replace(/^#+\s*/, '').trim();
        // Remove trailing page numbers if any (e.g. "Chapter 1 ... 15")
        cleanTitle = cleanTitle.replace(/\s+\.{2,}\s*\d+$/, '').replace(/\s+\d+$/, '').trim();

        const titleKey = cleanTitle.toLowerCase();
        if (!seenTitles.has(titleKey)) {
          seenTitles.add(titleKey);

          // Extract content preview snippet and full topic paragraphs until next chapter or end of spread
          let topicParas = [p];
          let snippet = '';
          
          for (let nextP = pIdx + 1; nextP < Math.min(pageParas.length, pIdx + 6); nextP++) {
            const nextText = cleanHtmlText(pageParas[nextP]);
            if (!nextText || nextText.length < 5) continue;
            if (/^(chapter\s+\d+|part\s+[ivx\d]+|letter\s+\d+|story\s+\d+|\d+\.\s+[a-z])/i.test(nextText)) break;
            topicParas.push(pageParas[nextP]);
            if (!snippet && nextText.length > 30) {
              snippet = nextText.slice(0, 240) + '...';
            }
          }

          // If snippet still empty, look into next page
          if (!snippet && pages[pageIdx + 1]) {
            const nextP = cleanHtmlText(pages[pageIdx + 1].split('</p>')[0]);
            snippet = nextP.slice(0, 240) + '...';
          }

          detectedChapters.push({
            id: `ch-${config.slug}-${detectedChapters.length + 1}`,
            order: detectedChapters.length + 1,
            title: cleanTitle,
            page: pageIdx + 1, // 1-indexed page number
            targetPage: pageIdx, // 0-indexed reader page
            snippet: snippet || `Key clinical and emotional insights for ${cleanTitle}.`,
            content: topicParas.map(tp => `<p>${tp}</p>`).join('\n')
          });
        }
      }
    }
  }

  // If chapter count is low (e.g. book has no explicit numbered headings), extract logical section headings
  if (detectedChapters.length < 5) {
    console.log(`Low chapter count (${detectedChapters.length}), extracting high-confidence sections...`);
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageHtml = pages[pageIdx];
      const pFirst = pageHtml.split('</p>')[0];
      const text = cleanHtmlText(pFirst);
      if (text.length > 5 && text.length < 80 && !seenTitles.has(text.toLowerCase())) {
        seenTitles.add(text.toLowerCase());
        detectedChapters.push({
          id: `ch-${config.slug}-${detectedChapters.length + 1}`,
          order: detectedChapters.length + 1,
          title: text,
          page: pageIdx + 1,
          targetPage: pageIdx,
          snippet: cleanHtmlText(pageHtml).slice(0, 200) + '...',
          content: pageHtml
        });
      }
    }
  }

  console.log(`Detected ${detectedChapters.length} structured chapters with accurate page mappings.`);

  return {
    title: config.title,
    subtitle: config.subtitle,
    category: config.category,
    author: config.author,
    desc: config.desc,
    description: config.desc,
    image: config.coverUrl,
    coverUrl: config.coverUrl,
    chapters: detectedChapters,
    pages: pages,
    totalChapters: detectedChapters.length,
    totalPages: pages.length
  };
}

async function main() {
  console.log(`Starting ingestion of 12 HealthSakhi DOCX Books...`);

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE ContentAsset MODIFY description LONGTEXT;');
    console.log('Modified ContentAsset.description to LONGTEXT.');
  } catch (alterErr) {
    console.warn('ALTER TABLE warning:', alterErr.message);
  }

  if (!fs.existsSync(FRONTEND_BOOKS_DIR)) fs.mkdirSync(FRONTEND_BOOKS_DIR, { recursive: true });
  if (!fs.existsSync(BACKEND_BOOKS_DIR)) fs.mkdirSync(BACKEND_BOOKS_DIR, { recursive: true });

  const existingAssets = await prisma.contentAsset.findMany({
    where: { type: 'Book' }
  });

  console.log(`Existing DB ContentAsset books count: ${existingAssets.length}`);

  for (let i = 0; i < BOOKS_CONFIG.length; i++) {
    const config = BOOKS_CONFIG[i];
    const docxPath = path.join(WORKSPACE_ROOT, config.docxFile);

    try {
      const parsedBook = await parseDocxBook(docxPath, config);

      // Match existing DB book by title or dbMatchTitle
      const matchedDbAsset = existingAssets.find(a => {
        const aTitle = (a.title || '').trim().toLowerCase();
        const confTitle = config.title.trim().toLowerCase();
        const matchTitle = (config.dbMatchTitle || '').trim().toLowerCase();
        return aTitle === confTitle || aTitle === matchTitle || aTitle.includes(matchTitle) || matchTitle.includes(aTitle);
      });

      // Format chapters for [hs_chapters] (compact format to preserve DB size)
      const cleanChaptersForDb = parsedBook.chapters.map(ch => ({
        id: ch.id,
        order: ch.order,
        title: ch.title,
        page: ch.page
      }));

      const fullDescriptionWithTags = `${parsedBook.desc} [hs_cover] ${config.coverUrl} [hs_chapters] ${JSON.stringify(cleanChaptersForDb)} [hs_access] Free`;

      let targetAssetId = null;

      if (matchedDbAsset) {
        console.log(`Found existing DB asset: "${matchedDbAsset.title}" (ID: ${matchedDbAsset.id}) -> Updating...`);
        const updated = await prisma.contentAsset.update({
          where: { id: matchedDbAsset.id },
          data: {
            title: config.title,
            category: config.category,
            status: 'Published',
            description: fullDescriptionWithTags,
            mediaUrl: matchedDbAsset.mediaUrl || config.coverUrl,
            groupKey: config.slug
          }
        });
        targetAssetId = updated.id;
      } else {
        console.log(`Creating new DB asset for: "${config.title}"...`);
        const created = await prisma.contentAsset.create({
          data: {
            title: config.title,
            type: 'Book',
            category: config.category,
            language: 'English',
            languageCode: 'en',
            groupKey: config.slug,
            status: 'Published',
            mediaUrl: config.coverUrl,
            description: fullDescriptionWithTags
          }
        });
        targetAssetId = created.id;
      }

      // Save standardized JSON files for reader and search catalog
      const bookPayload = {
        id: targetAssetId,
        slug: config.slug,
        title: config.title,
        subtitle: config.subtitle,
        category: config.category,
        author: config.author,
        desc: config.desc,
        description: config.desc,
        image: config.coverUrl,
        coverUrl: config.coverUrl,
        chapters: parsedBook.chapters,
        pages: parsedBook.pages
      };

      // Write with UUID
      const feUuidPath = path.join(FRONTEND_BOOKS_DIR, `book_${targetAssetId}_en.json`);
      const beUuidPath = path.join(BACKEND_BOOKS_DIR, `book_${targetAssetId}_en.json`);
      fs.writeFileSync(feUuidPath, JSON.stringify(bookPayload, null, 2), 'utf8');
      fs.writeFileSync(beUuidPath, JSON.stringify(bookPayload, null, 2), 'utf8');

      // Also write with numeric index (book_1_en.json to book_12_en.json) for static fallback
      const feNumPath = path.join(FRONTEND_BOOKS_DIR, `book_${i + 1}_en.json`);
      const beNumPath = path.join(BACKEND_BOOKS_DIR, `book_${i + 1}_en.json`);
      fs.writeFileSync(feNumPath, JSON.stringify(bookPayload, null, 2), 'utf8');
      fs.writeFileSync(beNumPath, JSON.stringify(bookPayload, null, 2), 'utf8');

      console.log(`Successfully saved book JSONs for ${config.title} (UUID: ${targetAssetId}, Num: ${i + 1})`);
    } catch (err) {
      console.error(`Error processing book ${config.title}:`, err);
    }
  }

  // Also update books_list.json in frontend
  const allDbBooks = await prisma.contentAsset.findMany({
    where: { type: 'Book', status: 'Published' }
  });

  const summaryList = allDbBooks.map(b => ({
    id: b.id,
    title: b.title,
    category: b.category,
    coverUrl: (b.description || '').includes('[hs_cover]')
      ? b.description.split('[hs_cover]')[1].split('[hs_chapters]')[0].trim()
      : b.mediaUrl
  }));

  fs.writeFileSync(path.join(FRONTEND_BOOKS_DIR, 'books_list.json'), JSON.stringify(summaryList, null, 2), 'utf8');
  console.log(`\nUpdated books_list.json with ${summaryList.length} published books.`);

  console.log(`\nIngestion of all 12 DOCX books completed successfully! 🎉`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal ingestion error:', err);
  process.exit(1);
});
