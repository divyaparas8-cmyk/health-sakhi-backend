const prisma = require('../config/database');
const path = require('path');
const fs = require('fs');

async function setup() {
  console.log('--- Setting up family_toolkits table and seeding initial data ---');

  // 1. Create table in MySQL if not exists
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS \`family_toolkits\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`slug\` VARCHAR(150) NOT NULL,
      \`title\` VARCHAR(255) NOT NULL,
      \`subtitle\` VARCHAR(255) NULL,
      \`category\` VARCHAR(100) NOT NULL,
      \`badge\` VARCHAR(100) NULL,
      \`accent_color\` VARCHAR(100) NULL,
      \`icon\` VARCHAR(50) NULL,
      \`read_time\` VARCHAR(100) NULL,
      \`summary\` TEXT NULL,
      \`cover_url\` VARCHAR(512) NULL,
      \`document_url\` VARCHAR(512) NULL,
      \`file_name\` VARCHAR(255) NULL,
      \`status\` VARCHAR(20) NOT NULL DEFAULT 'Published',
      \`sections\` LONGTEXT NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`family_toolkits_slug_key\`(\`slug\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `;

  try {
    await prisma.$executeRawUnsafe(createTableSql);
    console.log('✓ Table `family_toolkits` verified / created successfully.');

    // 2. Check if table has data
    const existing = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM `family_toolkits`');
    const count = Number(existing[0]?.cnt || 0);
    console.log(`Current toolkits count in DB: ${count}`);

    if (count === 0) {
      console.log('Seeding initial 13 toolkits from frontend dataset...');
      const dataFilePath = path.join(__dirname, '../../../frontenhealth/src/data/familyToolkitData.js');
      if (fs.existsSync(dataFilePath)) {
        const fileContent = fs.readFileSync(dataFilePath, 'utf8');
        // Extract array by finding first [ and last ]
        const startIndex = fileContent.indexOf('[');
        const endIndex = fileContent.lastIndexOf(']');
        if (startIndex !== -1 && endIndex !== -1) {
          const jsonStr = fileContent.substring(startIndex, endIndex + 1);
          const toolkits = JSON.parse(jsonStr);

          for (const item of toolkits) {
            const sectionsJson = item.sections ? JSON.stringify(item.sections) : null;
            await prisma.$executeRawUnsafe(
              `INSERT INTO \`family_toolkits\` 
              (\`id\`, \`slug\`, \`title\`, \`subtitle\`, \`category\`, \`badge\`, \`accent_color\`, \`icon\`, \`read_time\`, \`summary\`, \`cover_url\`, \`document_url\`, \`file_name\`, \`status\`, \`sections\`, \`created_at\`, \`updated_at\`)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              item.id || `toolkit-${Date.now()}`,
              item.slug || `toolkit-${Date.now()}`,
              item.title || 'Untitled Toolkit',
              item.subtitle || null,
              item.category || 'General',
              item.badge || null,
              item.accentColor || 'from-rose-500 to-red-600',
              item.icon || 'Shield',
              item.readTime || null,
              item.summary || null,
              item.coverUrl || null,
              item.documentUrl || null,
              item.fileName || null,
              'Published',
              sectionsJson
            );
          }
          console.log(`✓ Successfully seeded ${toolkits.length} toolkits into \`family_toolkits\`!`);
        }
      } else {
        console.warn('Could not find familyToolkitData.js at ' + dataFilePath);
      }
    } else {
      console.log('Table already populated with ' + count + ' records.');
    }
  } catch (err) {
    console.error('Error during setupFamilyToolkit:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

setup();
