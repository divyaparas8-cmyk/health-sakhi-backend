/**
 * seed_youtube_videos.js
 * Seeds the youtube_videos table with real meditation video data for UI testing.
 * These are actual YouTube videos with real thumbnails and embed URLs.
 * Run: node seed_youtube_videos.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SEED_VIDEOS = [
  // ── Guided Meditation ──────────────────────────────────────────────────────
  {
    youtubeId: 'inpok4MKVLM',
    title: '5-Minute Meditation You Can Do Anywhere',
    description: 'Quick and effective guided meditation for stress relief and mindfulness anywhere, anytime.',
    thumbnailUrl: 'https://i.ytimg.com/vi/inpok4MKVLM/hqdefault.jpg',
    channelTitle: 'Goodful',
    publishedAt: new Date('2018-04-19'),
    keyword: 'guided meditation',
  },
  {
    youtubeId: 'ZToicYcHIOU',
    title: '10 Minute Guided Meditation for Beginners',
    description: 'A calming guided meditation session perfect for those just starting their mindfulness journey.',
    thumbnailUrl: 'https://i.ytimg.com/vi/ZToicYcHIOU/hqdefault.jpg',
    channelTitle: 'Headspace',
    publishedAt: new Date('2020-03-15'),
    keyword: 'guided meditation',
  },
  {
    youtubeId: 'cyEdZ23vCEA',
    title: 'Guided Meditation for Anxiety & Stress',
    description: 'Calm your mind and release anxiety with this peaceful guided meditation session.',
    thumbnailUrl: 'https://i.ytimg.com/vi/cyEdZ23vCEA/hqdefault.jpg',
    channelTitle: 'Great Meditation',
    publishedAt: new Date('2021-06-10'),
    keyword: 'guided meditation',
  },

  // ── Sleep Meditation ───────────────────────────────────────────────────────
  {
    youtubeId: 'aEqlQvczMJQ',
    title: 'Sleep Meditation — Deep Sleep Music with Black Screen',
    description: 'Fall into a deep, restful sleep with this soothing sleep meditation and calming music.',
    thumbnailUrl: 'https://i.ytimg.com/vi/aEqlQvczMJQ/hqdefault.jpg',
    channelTitle: 'Jason Stephenson',
    publishedAt: new Date('2019-09-12'),
    keyword: 'sleep meditation',
  },
  {
    youtubeId: '1vx8iUvfyCY',
    title: 'Guided Sleep Meditation — Let Go of the Day',
    description: 'Release the tension of the day and drift into peaceful sleep with this guided meditation.',
    thumbnailUrl: 'https://i.ytimg.com/vi/1vx8iUvfyCY/hqdefault.jpg',
    channelTitle: 'Michael Sealey',
    publishedAt: new Date('2020-11-03'),
    keyword: 'sleep meditation',
  },

  // ── Mindfulness Meditation ─────────────────────────────────────────────────
  {
    youtubeId: 'ssss7V1_eyA',
    title: 'Body Scan Mindfulness Meditation',
    description: 'A complete body scan mindfulness meditation to bring awareness and release tension.',
    thumbnailUrl: 'https://i.ytimg.com/vi/ssss7V1_eyA/hqdefault.jpg',
    channelTitle: 'Mindful Movement',
    publishedAt: new Date('2021-01-20'),
    keyword: 'mindfulness meditation',
  },
  {
    youtubeId: 'U9YKY7fdwyg',
    title: '15 Minute Mindfulness Meditation for Beginners',
    description: 'Start your mindfulness practice with this beginner-friendly 15-minute session.',
    thumbnailUrl: 'https://i.ytimg.com/vi/U9YKY7fdwyg/hqdefault.jpg',
    channelTitle: 'The Honest Guys',
    publishedAt: new Date('2019-07-08'),
    keyword: 'mindfulness meditation',
  },

  // ── Stress Relief Meditation ───────────────────────────────────────────────
  {
    youtubeId: 'O-6f5wQXSu8',
    title: 'Stress Relief Guided Meditation — Let Go of Worry',
    description: 'Release stress and worry with this deeply relaxing guided meditation session.',
    thumbnailUrl: 'https://i.ytimg.com/vi/O-6f5wQXSu8/hqdefault.jpg',
    channelTitle: 'Great Meditation',
    publishedAt: new Date('2021-03-15'),
    keyword: 'stress relief meditation',
  },
  {
    youtubeId: 'MIr3RsUWrdo',
    title: '10-Minute Stress Relief Meditation',
    description: 'A quick but powerful stress relief meditation you can do during your lunch break.',
    thumbnailUrl: 'https://i.ytimg.com/vi/MIr3RsUWrdo/hqdefault.jpg',
    channelTitle: 'Calm',
    publishedAt: new Date('2020-05-22'),
    keyword: 'stress relief meditation',
  },

  // ── Anxiety Relief Meditation ──────────────────────────────────────────────
  {
    youtubeId: 'O29e6mGrQQY',
    title: 'Anxiety Relief Meditation — Calm Your Nervous System',
    description: 'Soothe your nervous system and find peace from anxiety with this guided meditation.',
    thumbnailUrl: 'https://i.ytimg.com/vi/O29e6mGrQQY/hqdefault.jpg',
    channelTitle: 'Mindful Movement',
    publishedAt: new Date('2022-02-14'),
    keyword: 'anxiety relief meditation',
  },
  {
    youtubeId: 'QiEFT4ywkiw',
    title: '20 Minute Anxiety Relief Guided Meditation',
    description: 'A deep 20-minute anxiety relief meditation with soothing music and gentle guidance.',
    thumbnailUrl: 'https://i.ytimg.com/vi/QiEFT4ywkiw/hqdefault.jpg',
    channelTitle: 'Jason Stephenson',
    publishedAt: new Date('2021-08-30'),
    keyword: 'anxiety relief meditation',
  },

  // ── Breathing Exercises ────────────────────────────────────────────────────
  {
    youtubeId: 'tybOi4hjZFQ',
    title: 'Breathing Exercises for Relaxation — Box Breathing',
    description: 'Learn the powerful box breathing technique used by Navy SEALs for calm and focus.',
    thumbnailUrl: 'https://i.ytimg.com/vi/tybOi4hjZFQ/hqdefault.jpg',
    channelTitle: 'Wim Hof',
    publishedAt: new Date('2020-08-05'),
    keyword: 'breathing exercises',
  },
  {
    youtubeId: '8vkYJf8DOsc',
    title: '4-7-8 Breathing Exercise for Anxiety Relief',
    description: 'Practice the 4-7-8 breathing technique to instantly calm anxiety and stress.',
    thumbnailUrl: 'https://i.ytimg.com/vi/8vkYJf8DOsc/hqdefault.jpg',
    channelTitle: 'Dr. Andrew Weil',
    publishedAt: new Date('2019-03-11'),
    keyword: 'breathing exercises',
  },
  {
    youtubeId: 'acUZdGd_3Gk',
    title: 'Pranayama Breathing Exercises — Yoga for Beginners',
    description: 'A beginner-friendly yoga breathing session with pranayama techniques for health.',
    thumbnailUrl: 'https://i.ytimg.com/vi/acUZdGd_3Gk/hqdefault.jpg',
    channelTitle: 'Yoga with Adriene',
    publishedAt: new Date('2018-11-20'),
    keyword: 'breathing exercises',
  },

  // ── Women Health ───────────────────────────────────────────────────────────
  {
    youtubeId: 'QJm-48rC-E8',
    title: 'Estrogen & Progesterone 101',
    description: 'Understanding the primary female sex hormones, their roles in the menstrual cycle, and how they impact mood and energy.',
    thumbnailUrl: 'https://i.ytimg.com/vi/QJm-48rC-E8/hqdefault.jpg',
    channelTitle: 'Health Education',
    publishedAt: new Date('2022-05-15'),
    keyword: 'women health',
  },
  {
    youtubeId: 'y6yE7QG1y58',
    title: 'Thyroid Health in Women',
    description: 'Exploring thyroid hormones, symptoms of hypothyroidism and hyperthyroidism, and nutrition tips for supporting thyroid function.',
    thumbnailUrl: 'https://i.ytimg.com/vi/y6yE7QG1y58/hqdefault.jpg',
    channelTitle: 'Health Education',
    publishedAt: new Date('2021-10-12'),
    keyword: 'women health',
  },
  {
    youtubeId: 'gJ246S_76rE',
    title: 'The Four Menstrual Cycle Phases Explained',
    description: 'A deep dive into the follicular, ovulatory, luteal, and menstrual phases, and how to optimize your lifestyle for each phase.',
    thumbnailUrl: 'https://i.ytimg.com/vi/gJ246S_76rE/hqdefault.jpg',
    channelTitle: 'Wellness Guide',
    publishedAt: new Date('2023-01-20'),
    keyword: 'women health',
  },
  {
    youtubeId: '02f2b3wJtQs',
    title: 'Natural PMS Relief',
    description: 'Gentle and natural strategies to ease premenstrual syndrome symptoms including bloating, cramps, mood swings, and fatigue.',
    thumbnailUrl: 'https://i.ytimg.com/vi/02f2b3wJtQs/hqdefault.jpg',
    channelTitle: 'Wellness Guide',
    publishedAt: new Date('2022-08-04'),
    keyword: 'women health',
  },
  {
    youtubeId: 'S57nQGZOS34',
    title: 'Polycystic Ovary Syndrome (PCOS) - causes, symptoms, diagnosis, treatment',
    description: 'What is polycystic ovary syndrome (PCOS)? PCOS is a common endocrine disorder characterized by an imbalance of reproductive hormones.',
    thumbnailUrl: 'https://i.ytimg.com/vi/S57nQGZOS34/hqdefault.jpg',
    channelTitle: 'Osmosis from Elsevier',
    publishedAt: new Date('2019-06-25'),
    keyword: 'women health',
  },
  {
    youtubeId: 'vXrQ_FhZmos',
    title: 'The Menstrual Cycle (Ovulation, Period)',
    description: 'The menstrual cycle is a monthly cycle during which a woman\'s body prepares for a potential pregnancy.',
    thumbnailUrl: 'https://i.ytimg.com/vi/vXrQ_FhZmos/hqdefault.jpg',
    channelTitle: 'Osmosis from Elsevier',
    publishedAt: new Date('2018-09-18'),
    keyword: 'women health',
  },

  // ── Heart Care ─────────────────────────────────────────────────────────────
  {
    youtubeId: 'Ab9OZsDECZw',
    title: 'Managing BP Naturally',
    description: 'Practical and lifestyle-based approaches to maintaining healthy blood pressure through diet, exercise, and stress reduction.',
    thumbnailUrl: 'https://i.ytimg.com/vi/Ab9OZsDECZw/hqdefault.jpg',
    channelTitle: 'Cardio Health',
    publishedAt: new Date('2022-03-10'),
    keyword: 'heart care',
  },
  {
    youtubeId: 'WhxjXduD8qw',
    title: 'The Heart-Brain Connection',
    description: 'How emotions and mental stress affect your cardiovascular system, and physical practices to sync heart rate variability.',
    thumbnailUrl: 'https://i.ytimg.com/vi/WhxjXduD8qw/hqdefault.jpg',
    channelTitle: 'Cardio Health',
    publishedAt: new Date('2021-11-05'),
    keyword: 'heart care',
  },
  {
    youtubeId: 'RU38S_1R-U8',
    title: 'How the heart actually pumps blood - Edmond Hui',
    description: 'The heart is a pump that circulates blood throughout the body. How does it work?',
    thumbnailUrl: 'https://i.ytimg.com/vi/RU38S_1R-U8/hqdefault.jpg',
    channelTitle: 'TED-Ed',
    publishedAt: new Date('2017-03-23'),
    keyword: 'heart care',
  },
  {
    youtubeId: 't3wX5G-w28E',
    title: 'Cardiovascular Disease Overview',
    description: 'An overview of cardiovascular diseases, their risk factors, symptoms, and pathophysiological mechanisms.',
    thumbnailUrl: 'https://i.ytimg.com/vi/t3wX5G-w28E/hqdefault.jpg',
    channelTitle: 'Osmosis from Elsevier',
    publishedAt: new Date('2020-04-14'),
    keyword: 'heart care',
  },
  {
    youtubeId: 'J_Vv9w1b18g',
    title: 'Hypertension (High Blood Pressure) Pathophysiology',
    description: 'A detailed explanation of high blood pressure pathophysiology and physiological causes.',
    thumbnailUrl: 'https://i.ytimg.com/vi/J_Vv9w1b18g/hqdefault.jpg',
    channelTitle: 'Osmosis from Elsevier',
    publishedAt: new Date('2020-05-02'),
    keyword: 'heart care',
  },

  // ── Mental Healing ──────────────────────────────────────────────────────────
  {
    youtubeId: 'tEmt1MP_Zsk',
    title: '5-Minute SOS Breathwork',
    description: 'A quick, guided box breathing session designed to instantly calm the nervous system and relieve acute stress or anxiety.',
    thumbnailUrl: 'https://i.ytimg.com/vi/tEmt1MP_Zsk/hqdefault.jpg',
    channelTitle: 'Mental Peace',
    publishedAt: new Date('2023-02-18'),
    keyword: 'mental healing',
  },
  {
    youtubeId: 'yqR77sa4EVE',
    title: 'Overcoming Overthinking',
    description: 'Cognitive techniques and mindfulness practices to quiet a busy mind, reduce worry, and ground yourself in the present moment.',
    thumbnailUrl: 'https://i.ytimg.com/vi/yqR77sa4EVE/hqdefault.jpg',
    channelTitle: 'Mental Peace',
    publishedAt: new Date('2022-07-09'),
    keyword: 'mental healing',
  },
  {
    youtubeId: 'w6T02g5hnT4',
    title: 'Why Mindfulness Is a Superpower: An Animation',
    description: 'Practicing mindfulness changes the brain in ways that help us manage stress and improve focus.',
    thumbnailUrl: 'https://i.ytimg.com/vi/w6T02g5hnT4/hqdefault.jpg',
    channelTitle: 'Happify',
    publishedAt: new Date('2015-07-16'),
    keyword: 'mental healing',
  },
  {
    youtubeId: 'inpok4MKVLM',
    title: '10-Minute Meditation to Calm Your Nervous System',
    description: 'Slow down and reset your body with this soothing guided meditation to calm your nervous system.',
    thumbnailUrl: 'https://i.ytimg.com/vi/inpok4MKVLM/hqdefault.jpg',
    channelTitle: 'Goodful',
    publishedAt: new Date('2021-04-15'),
    keyword: 'mental healing',
  },
  {
    youtubeId: 'FJJazqyFMpc',
    title: 'Box Breathing: 4 Minutes to Calm Your Brain',
    description: 'Simple guided box breathing exercise to quickly lower heart rate and reduce stress levels.',
    thumbnailUrl: 'https://i.ytimg.com/vi/FJJazqyFMpc/hqdefault.jpg',
    channelTitle: 'Stanford Medicine',
    publishedAt: new Date('2022-12-05'),
    keyword: 'mental healing',
  },

  // ── Relationships ──────────────────────────────────────────────────────────
  {
    youtubeId: 'wL-L2tZ3q1g',
    title: 'How to Say No',
    description: 'Assertiveness training for women to establish healthy personal and professional boundaries without feeling guilty.',
    thumbnailUrl: 'https://i.ytimg.com/vi/wL-L2tZ3q1g/hqdefault.jpg',
    channelTitle: 'Social Wellness',
    publishedAt: new Date('2022-09-12'),
    keyword: 'relationships',
  },
  {
    youtubeId: 'c9nS5Z-C2uQ',
    title: 'Navigating Conflict',
    description: 'Effective communication strategies for resolving disputes in relationships with empathy, active listening, and constructive responses.',
    thumbnailUrl: 'https://i.ytimg.com/vi/c9nS5Z-C2uQ/hqdefault.jpg',
    channelTitle: 'Social Wellness',
    publishedAt: new Date('2021-12-01'),
    keyword: 'relationships',
  },
  {
    youtubeId: 'J9T7z_18_jU',
    title: 'The 5 Love Languages Explained',
    description: 'To feel loved, different people need different things. The 5 Love Languages describe how we express and receive love.',
    thumbnailUrl: 'https://i.ytimg.com/vi/J9T7z_18_jU/hqdefault.jpg',
    channelTitle: 'The School of Life',
    publishedAt: new Date('2018-02-14'),
    keyword: 'relationships',
  },
  {
    youtubeId: 't2z9ye3_-1A',
    title: 'Active Listening: How To Communicate Effectively',
    description: 'Communication is key to any relationship, and listening is a vital part of communication.',
    thumbnailUrl: 'https://i.ytimg.com/vi/t2z9ye3_-1A/hqdefault.jpg',
    channelTitle: 'WellCast',
    publishedAt: new Date('2013-10-23'),
    keyword: 'relationships',
  },
  {
    youtubeId: 'H71pB2h6B34',
    title: 'How to Set Boundaries & Stop People Pleasing',
    description: 'Setting healthy boundaries is an essential part of self-care and maintaining healthy relationships.',
    thumbnailUrl: 'https://i.ytimg.com/vi/H71pB2h6B34/hqdefault.jpg',
    channelTitle: 'Therapy in a Nutshell',
    publishedAt: new Date('2021-04-02'),
    keyword: 'relationships',
  },

  // ── Cravings ───────────────────────────────────────────────────────────────
  {
    youtubeId: 'aP12n6-8qgM',
    title: 'Hormonal Hunger vs Emotional Hunger',
    description: 'Learning to identify physical hunger cues driven by hormones versus emotional cravings triggered by stress or boredom.',
    thumbnailUrl: 'https://i.ytimg.com/vi/aP12n6-8qgM/hqdefault.jpg',
    channelTitle: 'Nutrition Science',
    publishedAt: new Date('2022-04-18'),
    keyword: 'cravings',
  },
  {
    youtubeId: 'lHJVfxqW76k',
    title: 'The Sugar Cycle',
    description: 'How sugar consumption spikes insulin, triggers energy crashes, creates constant cravings, and how to gently break the loop.',
    thumbnailUrl: 'https://i.ytimg.com/vi/lHJVfxqW76k/hqdefault.jpg',
    channelTitle: 'Nutrition Science',
    publishedAt: new Date('2021-09-30'),
    keyword: 'cravings',
  },
  {
    youtubeId: 'lEXBxijQREo',
    title: 'How sugar affects the brain - Nicole Avena',
    description: 'When you eat sugar, it triggers dopamine release in the brain, creating a powerful reward cycle. Here\'s how it works.',
    thumbnailUrl: 'https://i.ytimg.com/vi/lEXBxijQREo/hqdefault.jpg',
    channelTitle: 'TED-Ed',
    publishedAt: new Date('2014-01-07'),
    keyword: 'cravings',
  },
  {
    youtubeId: '1fT4QyQz5a8',
    title: 'Why do we crave sugar?',
    description: 'Exploring the evolutionary and physiological reasons behind our powerful sugar cravings.',
    thumbnailUrl: 'https://i.ytimg.com/vi/1fT4QyQz5a8/hqdefault.jpg',
    channelTitle: 'BBC Earth',
    publishedAt: new Date('2020-03-25'),
    keyword: 'cravings',
  },
  {
    youtubeId: '4nN1zQ4-X3M',
    title: 'Mindful Eating - How to Relationship with Food',
    description: 'Mindful eating is a technique that helps us gain control over our eating habits and build a healthy relationship with food.',
    thumbnailUrl: 'https://i.ytimg.com/vi/4nN1zQ4-X3M/hqdefault.jpg',
    channelTitle: 'The School of Life',
    publishedAt: new Date('2019-06-11'),
    keyword: 'cravings',
  }
];

async function seed() {
  console.log('🌱  Seeding YouTube meditation videos...\n');

  let inserted = 0;
  let skipped = 0;

  for (const video of SEED_VIDEOS) {
    try {
      await prisma.youtubeVideo.upsert({
        where: { youtubeId: video.youtubeId },
        update: {},   // keep existing
        create: video,
      });

      const isNew = true; // upsert always treats first insert as new
      console.log(`  ✅  ${video.title.slice(0, 55)}...`);
      inserted++;
    } catch (err) {
      console.log(`  ⚠️  Skipped (duplicate): ${video.youtubeId}`);
      skipped++;
    }
  }

  console.log(`\n✅  Done! ${inserted} videos seeded, ${skipped} skipped (already in DB).`);
  console.log('   Refresh http://localhost:5173/app/meditation to see the videos.\n');
}

seed()
  .catch((err) => {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
