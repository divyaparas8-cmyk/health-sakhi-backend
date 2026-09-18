const prisma = require('../config/database');

const BASELINE_CATEGORIES = [
  'Emergency & Critical Care',
  'Chronic Care',
  'Daily Care & Nursing',
  'Health Monitoring',
  'Family & Child Safety',
  'Preventive Health',
  'Family Directory & Cards',
  'Mental & Family Wellness'
];

const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-');
};

async function setupCategories() {
  console.log('--- Setting up family_toolkit_categories table ---');

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS \`family_toolkit_categories\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`slug\` VARCHAR(120) NOT NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`family_toolkit_categories_name_key\`(\`name\`),
      UNIQUE INDEX \`family_toolkit_categories_slug_key\`(\`slug\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `;

  try {
    await prisma.$executeRawUnsafe(createTableSql);
    console.log('✓ Table `family_toolkit_categories` verified/created.');

    const existing = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM `family_toolkit_categories`');
    const count = Number(existing[0]?.cnt || 0);
    console.log(`Current categories count: ${count}`);

    if (count === 0) {
      console.log('Seeding baseline categories...');
      for (const catName of BASELINE_CATEGORIES) {
        const slug = generateSlug(catName);
        const id = `cat-${slug}`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`family_toolkit_categories\` (\`id\`, \`name\`, \`slug\`, \`created_at\`, \`updated_at\`)
           VALUES (?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE \`updated_at\` = NOW()`,
          id,
          catName,
          slug
        );
      }
      console.log(`✓ Successfully seeded ${BASELINE_CATEGORIES.length} categories.`);
    }
  } catch (err) {
    console.error('Error during setupCategories:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

setupCategories();
