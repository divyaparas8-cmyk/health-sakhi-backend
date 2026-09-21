const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const prisma = require('../../config/database');
const logger = require('../../utils/logger');

const BOOKS_DIR = path.resolve(__dirname, '../../data/library_books');

// Gemini client initialization
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const primaryModelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
let genAI = null;
if (geminiApiKey) {
  try {
    genAI = new GoogleGenerativeAI(geminiApiKey);
  } catch (err) {
    logger.warn('[librarySearch] Failed to initialize GoogleGenerativeAI:', err.message);
  }
}

// In-memory cache for static book catalog to make searches ultra-fast
let bookCatalogCache = null;
let lastCacheLoad = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Strip HTML tags to get clean plain text
 */
const stripHtml = (html) => {
  if (!html) return '';
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Load all static JSON books into memory
 */
const loadStaticBooks = () => {
  const now = Date.now();
  if (bookCatalogCache && now - lastCacheLoad < CACHE_TTL_MS) {
    return bookCatalogCache;
  }

  const books = [];
  if (!fs.existsSync(BOOKS_DIR)) {
    return books;
  }

  try {
    const files = fs.readdirSync(BOOKS_DIR).filter(f => f.startsWith('book_') && f.endsWith('.json') && !f.startsWith('books_list'));
    for (const file of files) {
      try {
        const fullPath = path.join(BOOKS_DIR, file);
        const raw = fs.readFileSync(fullPath, 'utf8');
        const data = JSON.parse(raw);
        if (data && data.title) {
          // Extract language code from filename (e.g. book_1_en.json -> en)
          const parts = file.replace('.json', '').split('_');
          const lang = parts.length >= 3 ? parts[2] : 'en';
          books.push({
            id: String(data.id || parts[1]),
            fileId: parts[1],
            lang,
            title: data.title,
            subtitle: data.subtitle || '',
            author: data.author || 'Dr. Pratap Madhukar',
            category: data.category || 'Women Health',
            desc: data.desc || data.description || '',
            image: data.image || '/Images/heart to heart.png',
            chapters: Array.isArray(data.chapters) ? data.chapters : [],
            pages: Array.isArray(data.pages) ? data.pages : []
          });
        }
      } catch (err) {
        // Skip malformed files silently
      }
    }
    bookCatalogCache = books;
    lastCacheLoad = now;
    logger.info(`[librarySearch] Loaded ${books.length} static book editions into cache`);
  } catch (err) {
    logger.error('[librarySearch] Error reading static books dir:', err);
  }

  return books;
};

/**
 * Gemini Query Understanding Layer
 * STRICT: Intent & topic mapping ONLY. No diagnosis, no medical advice.
 */
const getGeminiSearchKeywords = async (query, lang = 'en') => {
  if (!genAI || !query || query.trim().length < 3) {
    return [];
  }

  const prompt = `You are a search understanding layer for the HealthSakhi Women's Health & Wellness Book Library.
The user entered this search query: "${query}" (preferred language: ${lang}).

YOUR TASK:
Analyze the user's intent and extract 4 to 8 relevant search keywords, symptoms, or health topics to match in the stored book library.
Example:
- Query: "why do I feel tired" -> ["fatigue", "tired", "energy", "exhaustion", "hormonal balance", "anemia", "sleep"]
- Query: "irregular cycle" -> ["periods", "menstruation", "cycle", "hormones", "pcos", "pcod"]
- Query: "skin glow" -> ["skin health", "beauty", "nutrition", "natural care", "radiance"]

CRITICAL MEDICAL SAFETY RULES:
- DO NOT answer the user's question.
- DO NOT diagnose, treat, or suggest remedies or medications.
- DO NOT give personalized medical advice.
- Return ONLY a JSON array of keyword strings. No explanations or extra text.`;

  const modelsToTry = [primaryModelName, 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      // Extract JSON array
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          return parsed.map(k => String(k).toLowerCase().trim()).filter(Boolean);
        }
      }
    } catch (err) {
      logger.warn(`[librarySearch] Gemini intent extraction failed on model ${modelName}:`, err.message);
    }
  }

  return [];
};

/**
 * Search across:
 * 1. Book Titles
 * 2. Categories
 * 3. Index / Chapter Titles
 * 4. Page Titles & Paragraphs
 * 5. DB ContentAssets
 */
const findABook = async ({ query, category, lang = 'en', limit = 20 }) => {
  if (!query || query.trim() === '') {
    return {
      success: true,
      query: '',
      results: [],
      total: 0,
      aiKeywords: []
    };
  }

  const cleanQuery = query.trim().toLowerCase();
  const queryTokens = cleanQuery.split(/\s+/).filter(t => t.length > 2);

  // 1. Get AI semantic keywords
  let aiKeywords = [];
  try {
    aiKeywords = await getGeminiSearchKeywords(query, lang);
  } catch (err) {
    logger.warn('[librarySearch] Gemini intent extraction error:', err);
  }

  const allSearchTerms = Array.from(new Set([cleanQuery, ...queryTokens, ...aiKeywords]));

  // 2. Fetch Stored CMS ContentAssets from DB
  const whereAsset = { type: 'Book', status: 'Published' };
  if (category && category !== 'All') {
    whereAsset.category = category;
  }

  let dbAssets = [];
  try {
    dbAssets = await prisma.contentAsset.findMany({
      where: whereAsset,
      select: {
        id: true,
        title: true,
        category: true,
        language: true,
        languageCode: true,
        mediaUrl: true,
        description: true
      }
    });
  } catch (err) {
    logger.error('[librarySearch] DB ContentAsset query failed:', err);
  }

  // 3. Load Static Books
  const staticBooks = loadStaticBooks();

  const results = [];
  const seenMatches = new Set(); // Prevent duplicate cards for identical book+page

  // Helper to test term matching
  const matchScore = (text) => {
    if (!text) return 0;
    const lower = text.toLowerCase();
    let score = 0;
    if (lower.includes(cleanQuery)) score += 10;
    for (const token of queryTokens) {
      if (lower.includes(token)) score += 4;
    }
    for (const kw of aiKeywords) {
      if (lower.includes(kw)) score += 2;
    }
    return score;
  };

  // ── A. SEARCH IN DB ASSETS ──────────────────────────────────────────────────
  for (const asset of dbAssets) {
    const rawDesc = asset.description || '';
    let coverUrl = null;
    if (rawDesc.includes('[hs_cover]')) {
      const part = rawDesc.split('[hs_cover]')[1];
      if (part) {
        coverUrl = part.split('[hs_chapters]')[0].split('[hs_access]')[0].trim();
      }
    }

    let cleanDesc = rawDesc
      .split('[hs_cover]')[0]
      .split('[hs_chapters]')[0]
      .split('[hs_access]')[0]
      .trim();

    // Check chapters from [hs_chapters]
    let parsedChapters = [];
    if (rawDesc.includes('[hs_chapters]')) {
      const chPart = rawDesc.split('[hs_chapters]')[1];
      if (chPart) {
        const jsonStr = chPart.split('[hs_access]')[0].trim();
        try {
          const arr = JSON.parse(jsonStr);
          if (Array.isArray(arr)) parsedChapters = arr;
        } catch (e) {}
      }
    }

    // Match in Asset Title or Category or Description
    const titleScore = matchScore(asset.title);
    const catScore = matchScore(asset.category);
    const descScore = matchScore(cleanDesc);

    if (titleScore > 0 || catScore > 0 || descScore > 0) {
      const key = `${asset.id}_0`;
      if (!seenMatches.has(key)) {
        seenMatches.add(key);
        results.push({
          bookId: asset.id,
          bookTitle: asset.title,
          bookCover: coverUrl || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=400',
          category: asset.category || 'Women Health',
          matchedSection: parsedChapters[0]?.title || 'Overview & Introduction',
          pageNumber: 0,
          preview: cleanDesc ? cleanDesc.slice(0, 160) + '...' : `Explore ${asset.title} in the ${asset.category} section.`,
          exactParagraph: cleanDesc,
          language: asset.languageCode || 'en',
          source: 'cms_asset',
          score: (titleScore * 3) + (catScore * 2) + descScore
        });
      }
    }

    // Match in each chapter of the DB asset
    for (let i = 0; i < parsedChapters.length; i++) {
      const ch = parsedChapters[i];
      const chTitle = typeof ch === 'string' ? ch : (ch.title || `Chapter ${i + 1}`);
      const chScore = matchScore(chTitle);
      if (chScore > 0) {
        const targetPage = ch.page !== undefined ? (ch.page - 1) : i;
        const key = `${asset.id}_${targetPage}`;
        if (!seenMatches.has(key)) {
          seenMatches.add(key);
          results.push({
            bookId: asset.id,
            bookTitle: asset.title,
            bookCover: coverUrl || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=400',
            category: asset.category || 'Women Health',
            matchedSection: chTitle,
            pageNumber: Math.max(0, targetPage),
            preview: `Matching chapter in ${asset.title}: "${chTitle}"`,
            exactParagraph: chTitle,
            language: asset.languageCode || 'en',
            source: 'cms_asset',
            score: chScore * 2
          });
        }
      }
    }
  }

  // ── B. SEARCH IN PUBLISHED BOOKS (Full text + Index) ────────────────────────
  // Prioritize requested language, but fall back to English if language edition not found
  const filteredStatic = staticBooks.filter(b => {
    if (category && category !== 'All') {
      if ((b.category || '').toLowerCase() !== category.toLowerCase()) return false;
    }
    return b.lang === lang || b.lang === 'en';
  });

  for (const book of filteredStatic) {
    // 1. Check Chapters / Index titles
    if (Array.isArray(book.chapters)) {
      book.chapters.forEach((ch, chIdx) => {
        const chTitle = typeof ch === 'string' ? ch : (ch.title || '');
        const chScore = matchScore(chTitle);
        if (chScore > 0) {
          const targetPage = (ch.startPage !== undefined) ? ch.startPage : chIdx;
          const key = `${book.id}_${targetPage}`;
          if (!seenMatches.has(key)) {
            seenMatches.add(key);
            // Get sample snippet from that page
            const pageRaw = book.pages && book.pages[targetPage] ? book.pages[targetPage] : '';
            const plainPage = stripHtml(pageRaw);
            const preview = plainPage ? plainPage.slice(0, 160) + '...' : `Chapter: ${chTitle}`;

            results.push({
              bookId: book.id,
              bookTitle: book.title,
              bookCover: book.image || '/Images/heart to heart.png',
              category: book.category || 'Women Health',
              matchedSection: chTitle,
              pageNumber: targetPage,
              preview: preview,
              exactParagraph: plainPage.slice(0, 300),
              language: book.lang,
              source: 'published_book',
              score: (chScore * 3) + 5
            });
          }
        }
      });
    }

    // 2. Check Book Title & Category
    const bTitleScore = matchScore(book.title);
    const bCatScore = matchScore(book.category);
    if (bTitleScore > 0 || bCatScore > 0) {
      const key = `${book.id}_0`;
      if (!seenMatches.has(key)) {
        seenMatches.add(key);
        results.push({
          bookId: book.id,
          bookTitle: book.title,
          bookCover: book.image || '/Images/heart to heart.png',
          category: book.category,
          matchedSection: book.chapters && book.chapters[0]?.title ? book.chapters[0].title : 'Introduction',
          pageNumber: 0,
          preview: book.desc ? book.desc.slice(0, 160) + '...' : `Complete volume: ${book.title}`,
          exactParagraph: book.desc,
          language: book.lang,
          source: 'published_book',
          score: (bTitleScore * 4) + (bCatScore * 2)
        });
      }
    }

    // 3. Check Pages Content (Paragraphs)
    if (Array.isArray(book.pages)) {
      book.pages.forEach((pageHtml, pIdx) => {
        if (!pageHtml) return;
        const plain = stripHtml(pageHtml);
        const pScore = matchScore(plain);

        if (pScore > 0) {
          const key = `${book.id}_${pIdx}`;
          if (!seenMatches.has(key)) {
            seenMatches.add(key);

            // Find matching chapter title for this page
            let matchedChapter = 'Page ' + (pIdx + 1);
            if (Array.isArray(book.chapters)) {
              const foundCh = book.chapters.find(c => {
                if (c.startPage !== undefined && c.endPage !== undefined) {
                  return pIdx >= c.startPage && pIdx <= c.endPage;
                }
                return false;
              });
              if (foundCh && foundCh.title) matchedChapter = foundCh.title;
            }

            // Extract context snippet around the matched keyword
            let bestSnippet = plain.slice(0, 160) + '...';
            for (const term of allSearchTerms) {
              const idx = plain.toLowerCase().indexOf(term);
              if (idx !== -1) {
                const start = Math.max(0, idx - 40);
                const end = Math.min(plain.length, idx + term.length + 100);
                bestSnippet = (start > 0 ? '...' : '') + plain.slice(start, end).trim() + (end < plain.length ? '...' : '');
                break;
              }
            }

            results.push({
              bookId: book.id,
              bookTitle: book.title,
              bookCover: book.image || '/Images/heart to heart.png',
              category: book.category || 'Women Health',
              matchedSection: matchedChapter,
              pageNumber: pIdx,
              preview: bestSnippet,
              exactParagraph: plain.slice(0, 350),
              language: book.lang,
              source: 'published_book',
              score: pScore + 2
            });
          }
        }
      });
    }
  }

  // Sort results by match score descending
  results.sort((a, b) => b.score - a.score);

  return {
    success: true,
    query,
    total: results.length,
    aiKeywords,
    results: results.slice(0, limit)
  };
};

module.exports = {
  findABook,
  loadStaticBooks
};
