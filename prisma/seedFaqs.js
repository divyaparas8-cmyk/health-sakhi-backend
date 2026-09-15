const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Reading 100 questions daily messages content...');
  const jsonPath = path.join(__dirname, '../src/data/daily_messages_100.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('daily_messages_100.json not found at:', jsonPath);
    process.exit(1);
  }
  
  const dailyMessages = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${dailyMessages.length} daily messages.`);

  console.log('Cleaning existing FAQs...');
  await prisma.faq.deleteMany();

  const categories = [
    'Account',
    'Health Tracking',
    'Consultation',
    'Payments',
    'Privacy',
    'Technical Support'
  ];

  const faqsData = dailyMessages.map((item, index) => {
    // Determine category based on index
    const category = categories[index % categories.length];
    
    // Convert statement titles into engaging FAQ questions
    let question = item.title;
    if (!question.endsWith('?')) {
      if (question.startsWith('How') || question.startsWith('Why') || question.startsWith('Is') || question.startsWith('Can')) {
        question = question + '?';
      } else {
        question = 'How can I understand: "' + question + '"?';
      }
    }

    return {
      question: question,
      answer: item.message,
      category: category,
      displayOrder: item.day,
      status: 'Published',
      isPopular: item.day <= 5, // Mark first 5 as popular
      helpfulCount: Math.floor(Math.random() * 50) + 10,
      notHelpfulCount: Math.floor(Math.random() * 5)
    };
  });

  console.log('Seeding FAQs to database...');
  await prisma.faq.createMany({
    data: faqsData
  });

  console.log('FAQ seeding completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
