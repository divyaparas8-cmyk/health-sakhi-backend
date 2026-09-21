/**
 * HealthSakhi FAQ Dataset Import Script
 * 
 * Replaces existing demo FAQs with the approved 175 FAQ dataset.
 * - Confirms database connection
 * - Creates a timestamped JSON backup of current FAQ records
 * - Validates all 175 FAQ records
 * - Safely replaces records using a transaction
 * - Validates post-import data integrity
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function importFaqData() {
  console.log('=====================================================');
  console.log('🌸 HEALTHSAKHI FAQ DATASET IMPORT (175 APPROVED FAQS)');
  console.log('=====================================================\n');

  // 1. Confirm database connection & inspect existing data
  console.log('STEP 1: Connecting to database...');
  let oldFaqs = [];
  try {
    oldFaqs = await prisma.faq.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    console.log(`✓ Connected successfully. Current FAQ count in database: ${oldFaqs.length}`);
  } catch (err) {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  }

  // 2. Backup current FAQ records
  console.log('\nSTEP 2: Creating backup of existing FAQ records...');
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `faqs_backup_${timestamp}.json`);

  fs.writeFileSync(backupFilePath, JSON.stringify(oldFaqs, null, 2), 'utf8');

  // Verify backup
  if (!fs.existsSync(backupFilePath) || fs.statSync(backupFilePath).size === 0) {
    console.error('❌ Backup file creation failed or file is empty. Aborting import for safety.');
    process.exit(1);
  }
  console.log(`✓ Backup successfully saved to: ${backupFilePath}`);
  console.log(`✓ Verified backup contains ${oldFaqs.length} records (${fs.statSync(backupFilePath).size} bytes).`);

  // 3. Load and validate the new 175 FAQ dataset
  console.log('\nSTEP 3: Loading and validating 175 FAQ dataset...');
  const datasetPath = path.join(__dirname, '../src/data/faqs_175_dataset.json');
  if (!fs.existsSync(datasetPath)) {
    console.error(`❌ Dataset file not found at: ${datasetPath}`);
    process.exit(1);
  }

  const newFaqsData = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  console.log(`✓ Loaded ${newFaqsData.length} records from dataset.`);

  if (newFaqsData.length !== 175) {
    console.error(`❌ Expected exactly 175 records, but found ${newFaqsData.length}. Aborting.`);
    process.exit(1);
  }

  // Validation
  const errors = [];
  const seenQuestions = new Set();
  const seenOrders = new Set();

  const validatedRecords = newFaqsData.map((item, idx) => {
    const num = item.displayOrder || (idx + 1);
    
    if (!item.question || typeof item.question !== 'string' || item.question.trim().length === 0) {
      errors.push(`Record #${num}: Missing or empty question`);
    }

    if (!item.answer || typeof item.answer !== 'string' || item.answer.trim().length < 30) {
      errors.push(`Record #${num}: Missing or suspiciously short answer (< 30 chars)`);
    }

    if (!item.category || typeof item.category !== 'string' || item.category.trim().length === 0) {
      errors.push(`Record #${num}: Missing category`);
    }

    const qLower = item.question ? item.question.trim().toLowerCase() : '';
    if (seenQuestions.has(qLower)) {
      errors.push(`Record #${num}: Duplicate question title "${item.question}"`);
    }
    seenQuestions.add(qLower);

    if (seenOrders.has(num)) {
      errors.push(`Record #${num}: Duplicate displayOrder ${num}`);
    }
    seenOrders.add(num);

    return {
      question: item.question.trim(),
      answer: item.answer.trim(),
      category: item.category.trim(),
      displayOrder: num,
      status: item.status || 'Published',
      isPopular: Boolean(item.isPopular),
      helpfulCount: item.helpfulCount !== undefined ? item.helpfulCount : 0,
      notHelpfulCount: item.notHelpfulCount !== undefined ? item.notHelpfulCount : 0
    };
  });

  if (errors.length > 0) {
    console.error('❌ Validation failed with the following errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log('✓ Validation passed! All 175 records are clean, unique, and complete.');

  // 4. Safely execute database replacement inside transaction
  console.log('\nSTEP 4: Performing database replacement in transaction...');
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Delete old FAQs
      const deleteResult = await tx.faq.deleteMany({});
      console.log(`  - Deleted ${deleteResult.count} old FAQ records from 'faqs' table.`);

      // Insert new 175 FAQs
      const createResult = await tx.faq.createMany({
        data: validatedRecords
      });
      console.log(`  - Inserted ${createResult.count} new FAQ records.`);

      return createResult;
    });

    console.log(`✓ Database transaction committed successfully! Inserted: ${result.count} records.`);
  } catch (txError) {
    console.error('❌ Transaction failed and was rolled back:', txError);
    process.exit(1);
  }

  // 5. Post-import verification
  console.log('\nSTEP 5: Verifying live database state...');
  const postCount = await prisma.faq.count();
  console.log(`✓ Total FAQs in live database: ${postCount}`);

  if (postCount !== 175) {
    console.error(`❌ Verification failed! Expected 175, but found ${postCount}`);
    process.exit(1);
  }

  // Check categories breakdown
  const categoryStats = await prisma.faq.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { category: 'asc' }
  });

  console.log('\nCategory breakdown in database:');
  categoryStats.forEach(stat => {
    console.log(`  - ${stat.category}: ${stat._count.id} FAQs`);
  });

  // Check sample first and last
  const firstFaq = await prisma.faq.findFirst({ orderBy: { displayOrder: 'asc' } });
  const lastFaq = await prisma.faq.findFirst({ orderBy: { displayOrder: 'desc' } });

  console.log('\nFirst FAQ in database:');
  console.log(`  [#${firstFaq.displayOrder}] (${firstFaq.category}) ${firstFaq.question}`);
  console.log(`  Status: ${firstFaq.status} | Popular: ${firstFaq.isPopular}`);

  console.log('\nLast FAQ in database:');
  console.log(`  [#${lastFaq.displayOrder}] (${lastFaq.category}) ${lastFaq.question}`);
  console.log(`  Status: ${lastFaq.status} | Popular: ${lastFaq.isPopular}`);

  console.log('\n=====================================================');
  console.log('🎉 FAQ IMPORT COMPLETED SUCCESSFULLY! ALL 175 FAQS LIVE');
  console.log('=====================================================');
}

importFaqData()
  .catch(err => {
    console.error('Fatal error during FAQ import:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
