const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MISSING_VIDEOS = [
  // Relationships
  {
    youtubeId: '8jPQjjsBbIc', // The power of vulnerability
    title: 'How to Set Healthy Boundaries',
    description: 'Learn how to communicate your boundaries effectively.',
    thumbnailUrl: 'https://i.ytimg.com/vi/8jPQjjsBbIc/hqdefault.jpg',
    channelTitle: 'Relationships Guide',
    publishedAt: new Date('2023-01-10'),
    keyword: 'relationships',
  },
  {
    youtubeId: 'P_6vDLq64gE', // What makes a good life
    title: 'Active Listening & Conflict Resolution',
    description: 'Improve your relationships with active listening.',
    thumbnailUrl: 'https://i.ytimg.com/vi/P_6vDLq64gE/hqdefault.jpg',
    channelTitle: 'Social Wellness',
    publishedAt: new Date('2023-02-15'),
    keyword: 'relationships',
  },
  {
    youtubeId: '1Evwgu369Jw', // The skill of self confidence
    title: 'Navigating Difficult Conversations',
    description: 'How to handle hard conversations in your relationships.',
    thumbnailUrl: 'https://i.ytimg.com/vi/1Evwgu369Jw/hqdefault.jpg',
    channelTitle: 'Relationships Guide',
    publishedAt: new Date('2023-03-10'),
    keyword: 'relationships',
  },
  // Cravings
  {
    youtubeId: 'R1vskiVDwl4', // The power of introverts
    title: 'Overcoming Emotional Eating',
    description: 'Strategies to handle emotional eating and cravings.',
    thumbnailUrl: 'https://i.ytimg.com/vi/R1vskiVDwl4/hqdefault.jpg',
    channelTitle: 'Nutrition Science',
    publishedAt: new Date('2023-03-20'),
    keyword: 'cravings',
  },
  {
    youtubeId: 'Ks-_Mh1QhMc', // Your body language may shape who you are
    title: 'Mindful Eating Habits',
    description: 'How to build a healthy relationship with food.',
    thumbnailUrl: 'https://i.ytimg.com/vi/Ks-_Mh1QhMc/hqdefault.jpg',
    channelTitle: 'Wellness Guide',
    publishedAt: new Date('2023-04-12'),
    keyword: 'cravings',
  },
  // Women Health (replacing deleted ones)
  {
    youtubeId: 'RcGyVTAoXEU', // How to spot a liar
    title: 'Natural Hormonal Balance',
    description: 'Understanding your cycle and hormonal health.',
    thumbnailUrl: 'https://i.ytimg.com/vi/RcGyVTAoXEU/hqdefault.jpg',
    channelTitle: 'Health Education',
    publishedAt: new Date('2023-05-18'),
    keyword: 'women health',
  }
];

async function seedMissing() {
  console.log('Seeding missing videos...');
  for (const video of MISSING_VIDEOS) {
    await prisma.youtubeVideo.upsert({
      where: { youtubeId: video.youtubeId },
      update: { keyword: video.keyword }, // Update keyword just in case
      create: video,
    });
  }
  console.log('Done seeding missing videos!');
  await prisma.$disconnect();
}
seedMissing();
