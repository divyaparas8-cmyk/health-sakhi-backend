const model = require('./model');

// In-memory cache for public landing page config (60 seconds)
let publicCache = null;
let cacheExpiry = 0;
const CACHE_DURATION_MS = 60 * 1000;

// Invalidate cache on mutations
const invalidateCache = () => {
  publicCache = null;
  cacheExpiry = 0;
};

// Default static content seed definitions for the Landing Page sections
const DEFAULT_SECTIONS = [
  {
    sectionKey: 'hero',
    title: 'Health Sakhi',
    subtitle: 'Family Wellness',
    description: 'A wellness companion for modern families.',
    imageUrl: '/Images/group-photo edited 3.png',
    buttonText: 'EXPLORE SERVICES',
    buttonLink: '#wellness-books',
    extraJson: {
      secondaryButtonText: 'WATCH DEMO',
      secondaryButtonLink: '#',
      backgroundImage: '/Images/WhatsApp Image 2026-05-07 at 2.49.24 PM.jpeg',
      mobileCardImage: '/Images/mobilecard.png',
      videoSrc: 'https://ik.imagekit.io/jcohpdmi8/health-sakhi%20(1).mp4'
    },
    isActive: true
  },
  {
    sectionKey: 'features',
    title: 'Dr. Pratap Madhukar',
    subtitle: 'MBBS, MSc, PGDip',
    description: 'Lifestyle & Wellness Coach | Author | Founder, HealthSakhi',
    imageUrl: '/Images/dr-pratap-portrait.png',
    buttonText: 'Read More',
    buttonLink: '',
    extraJson: {
      experience: '36+ Years Experience',
      helpingFamilies: 'Helping Families',
      liveHealthier: 'Live Healthier, Happier & More Meaningful Lives',
      bioText1: 'With over 36 years of clinical experience in Family Medicine, Women’s Health, and Lifestyle Medicine, Dr. Pratap Madhukar has dedicated his career to improving the health and well-being of thousands of families. His work combines evidence-based medical knowledge with compassionate patient counseling, empowering individuals to make sustainable lifestyle changes for healthier lives.',
      bioText2: 'A Harvard-certified Lifestyle Medicine Coach and author of the HealthSakhi Wellness Book Series, he is known for translating complex medical concepts into practical, easy-to-follow guidance. His unique approach blends medical expertise, cultural understanding, and emotional support, helping families build healthier and more meaningful lives.',
      bioPhilosophy: '"A woman’s health is her family’s health."',
      statsText: 'HealthSakhi Wellness Books'
    },
    isActive: true
  },
  {
    sectionKey: 'books',
    title: 'Learning & Listening',
    subtitle: 'ज्ञान जो जीवन में बदलाव लाए',
    description: 'Explore a growing collection of wellness books and guided learning designed to support every stage of a woman’s journey.',
    imageUrl: '',
    buttonText: 'Explore Books',
    buttonLink: '#wellness-books',
    extraJson: {
      marqueeTitle: 'HEALTHSAKHI WELLNESS BOOKS',
      marqueeBooks: [
        { title: 'Heart to Heart', img: '/Images/heart to heart.png' },
        { title: 'Fountain of Family', img: '/Images/final cover fountain of family.png' },
        { title: 'PCOD Wellness', img: '/Images/final pcod book cover.png' },
        { title: 'Weight Loss', img: '/Images/final wt loss book cover.png' },
        { title: 'Life After Shaadi', img: '/Images/HS LIFE AFTRE SHAADI COVER.png' },
        { title: 'Menopause', img: '/Images/HS MENOPAUSE.png' },
        { title: 'Beauty Without Parlour', img: '/Images/final cover beauty without parlour.png' },
        { title: 'How to Read Husband', img: '/Images/HS HOW TO READ HUSBAND COVE R.png' },
        { title: 'How to Read Woman', img: '/Images/HOW TO READ WOMAN LIKE A POEM.png' },
        { title: '100 Operations', img: '/Images/100 operations.png' }
      ],
      resourcesBooks: [
        {
          id: 1,
          title: 'Heart to Heart',
          desc: 'A warm, compassionate conversation on the emotional, physical, and invisible burdens women carry, and how true healing begins.',
          img: '/Images/heart to heart.png',
          gradient: 'from-rose-50 to-pink-50'
        },
        {
          id: 2,
          title: 'Secret Mind Game',
          desc: '100 Letters for the Woman Ready to Heal.',
          img: '/Images/final wt loss book cover.png',
          gradient: 'from-purple-50 to-blue-50',
          pdfUrl: '/books/HealthSakhi_Complete_ThreeParts (2).pdf',
          fileUrl: '/files/HealthSakhi_Complete_ThreeParts.txt'
        },
        {
          id: 3,
          title: 'Fountain of Family',
          desc: 'The great skill every woman must know for a harmonious home.',
          img: '/Images/final cover fountain of family.png',
          gradient: 'from-amber-50 to-orange-50',
          dummyContent: '<h2>Fountain of Family</h2><p>Sakhi means your best friend. This book teaches you the great skill of family harmony - knowledge is power.</p>'
        }
      ]
    },
    isActive: true
  },
  {
    sectionKey: 'testimonials',
    title: 'Words from Our Sakhis',
    subtitle: 'Community Voices',
    description: '"Experience the journey of women who found their lifelong wellness companion."',
    imageUrl: '',
    buttonText: '',
    buttonLink: '',
    extraJson: {
      testimonialsList: [
        {
          name: 'Priya Sharma',
          role: 'Mother & Professional',
          quote: '"Finding Food Sakhi was a turning point. I finally understand my body\'s needs without feeling restricted. It\'s truly a companion."',
          img: '/Images/image10.png'
        },
        {
          name: 'Anjali Rao',
          role: 'Entrepreneur',
          quote: '"The Mood Sakhi feature is like having a friend who actually listens without judgment. It helped me manage my stress during growth phases."',
          img: '/Images/image11.png'
        },
        {
          name: 'Meera Kapoor',
          role: 'New Mother',
          quote: '"Motherhood felt overwhelming until I joined this community. The guidance from Motherhood Sakhi is invaluable and so gentle."',
          img: '/Images/image9.png'
        }
      ]
    },
    isActive: true
  },
  {
    sectionKey: 'pricing',
    title: 'Choose Your Wellness Plan 🌸',
    subtitle: 'AFFORDABLE CARE FOR EVERY FAMILY',
    description: 'Select a tailored subscription plan to unlock customized health resources, certified expert guides, and interactive AI wellness support.',
    imageUrl: '',
    buttonText: 'Choose Plan',
    buttonLink: '',
    extraJson: {},
    isActive: true
  },
  {
    sectionKey: 'blog',
    title: 'The Sakhi Journal (Blog)',
    subtitle: 'Wellness Insights',
    description: 'Simple, thoughtful insights for everyday wellness',
    imageUrl: '',
    buttonText: 'Read More',
    buttonLink: '',
    extraJson: {
      blogPosts: [
        {
          title: 'Ayurvedic Habits for Morning Energy',
          desc: 'Start your day with small rituals that bring lasting energy.',
          date: 'April 2025',
          img: '/Images/ayurvedic.png',
          tag: 'Wellness'
        },
        {
          title: 'The Silent Impact of Stress on Hormones',
          desc: 'Understand how stress shapes your body and mind.',
          date: 'April 2025',
          img: '/Images/silent.png',
          tag: 'Health'
        }
      ]
    },
    isActive: true
  },
  {
    sectionKey: 'cta',
    title: 'Start Your Wellness Journey',
    subtitle: 'Connect With Us',
    description: 'Have questions or need guidance? We’re here to support you — gently and privately.',
    imageUrl: '',
    buttonText: 'Send Message',
    buttonLink: '',
    extraJson: {
      safeSecureTitle: 'Safe & Secure',
      safeSecureDesc: 'Your information stays private. We never share your data.',
      email: 'myhealthsakhi@gmail.com',
      phone: '+91 800-123-4567'
    },
    isActive: true
  },
  {
    sectionKey: 'footer',
    title: '© 2026 HEALTHSAKHI WELLNESS. ALL RIGHTS RESERVED.',
    subtitle: '',
    description: 'Wellness companion for modern families.',
    imageUrl: '',
    buttonText: '',
    buttonLink: '',
    extraJson: {
      links: [
        { name: 'Privacy', path: '/privacy' },
        { name: 'Terms', path: '/terms' }
      ]
    },
    isActive: true
  }
];

// Helper to seed landing page sections on initial run
const seedIfEmpty = async () => {
  const existing = await model.getAllSections();
  if (existing.length === 0) {
    for (const section of DEFAULT_SECTIONS) {
      await model.updateSectionByKey(section.sectionKey, {
        title: section.title,
        subtitle: section.subtitle,
        description: section.description,
        imageUrl: section.imageUrl,
        buttonText: section.buttonText,
        buttonLink: section.buttonLink,
        extraJson: section.extraJson,
        isActive: section.isActive
      });
    }
  }
};

/**
 * Gets all active sections grouped by sectionKey
 * Caches database configuration for 60 seconds
 */
const getLandingPage = async () => {
  const now = Date.now();
  if (publicCache && now < cacheExpiry) {
    return publicCache;
  }

  // Pre-seed sections if none exist in the database
  await seedIfEmpty();

  const sections = await model.getActiveSections();

  // Group array records into dictionary of sectionKey -> section fields
  const grouped = {};
  sections.forEach(sec => {
    grouped[sec.sectionKey] = {
      id: sec.id,
      sectionKey: sec.sectionKey,
      title: sec.title,
      subtitle: sec.subtitle,
      description: sec.description,
      imageUrl: sec.imageUrl,
      buttonText: sec.buttonText,
      buttonLink: sec.buttonLink,
      extraJson: sec.extraJson || {},
      isActive: sec.isActive,
      updatedAt: sec.updatedAt
    };
  });

  publicCache = grouped;
  cacheExpiry = now + CACHE_DURATION_MS;
  return grouped;
};

/**
 * Admin Panel: Get all sections (both active & inactive)
 */
const getAdminLandingPage = async () => {
  await seedIfEmpty();
  const sections = await model.getAllSections();
  return sections;
};

/**
 * Update an existing landing page section
 */
const updateSection = async (key, data) => {
  validateSectionData(data);
  const updated = await model.updateSectionByKey(key, data);
  invalidateCache();
  return updated;
};

/**
 * Create a new landing page section
 */
const createSection = async (data) => {
  validateSectionData(data);
  const created = await model.createSection(data);
  invalidateCache();
  return created;
};

/**
 * Basic payload validation rules
 */
const validateSectionData = (data) => {
  if (data.sectionKey && typeof data.sectionKey !== 'string') {
    throw new Error('section_key must be a valid string');
  }
  if (data.title && typeof data.title !== 'string') {
    throw new Error('title must be a valid string');
  }
  if (data.extraJson && typeof data.extraJson !== 'object') {
    throw new Error('extra_json must be a valid JSON object');
  }
};

/**
 * Reset section to original default properties
 */
const resetSection = async (key) => {
  const defaultSec = DEFAULT_SECTIONS.find(s => s.sectionKey === key);
  if (!defaultSec) {
    throw new Error(`Section key ${key} not found in defaults.`);
  }
  const resetData = {
    title: defaultSec.title,
    subtitle: defaultSec.subtitle,
    description: defaultSec.description,
    imageUrl: defaultSec.imageUrl,
    buttonText: defaultSec.buttonText,
    buttonLink: defaultSec.buttonLink,
    extraJson: defaultSec.extraJson,
    isActive: defaultSec.isActive
  };
  const updated = await model.updateSectionByKey(key, resetData);
  invalidateCache();
  return updated;
};

/**
 * Create a new contact message inquiry
 */
const createContactMessage = async (name, email, message, type = 'inquiry', role = '', rating = 5) => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Name is required and must be a string');
  }
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    throw new Error('Email is required and must be a string');
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Message content is required and must be a string');
  }
  const msgType = type === 'feedback' ? 'feedback' : 'inquiry';
  const numRating = Number(rating) || 5;

  const createdMsg = await model.createContactMessage({
    name: name.trim(),
    email: email.trim(),
    message: message.trim(),
    type: msgType,
    role: role ? role.trim() : (msgType === 'feedback' ? 'Community Sakhi' : null),
    rating: numRating,
    status: 'pending'
  });

  try {
    const { createAdminNotification } = require('../notifications/notifications.service');
    await createAdminNotification(
      `New User ${msgType === 'feedback' ? 'Feedback' : 'Inquiry'}`,
      `Message from ${name.trim()} (${email.trim()}): "${message.trim().substring(0, 80)}${message.trim().length > 80 ? '...' : ''}"`,
      'system'
    );
  } catch (err) {
    logger.error(`[Admin Notification Error] ${err.message}`);
  }

  return createdMsg;
};

/**
 * Fetch all contact messages
 */
const getContactMessages = async () => {
  return model.getContactMessages();
};

/**
 * Fetch approved feedbacks
 */
const getApprovedFeedbacks = async () => {
  return model.getApprovedFeedbacks();
};

/**
 * Update message status (e.g. approve feedback)
 */
const updateContactMessageStatus = async (id, status) => {
  if (!id) throw new Error('Message ID is required');
  return model.updateContactMessageStatus(id, status);
};

/**
 * Mark a contact message as read
 */
const markContactMessageAsRead = async (id) => {
  if (!id) throw new Error('Message ID is required');
  return model.markContactMessageAsRead(id);
};

/**
 * Delete a contact message
 */
const deleteContactMessage = async (id) => {
  if (!id) throw new Error('Message ID is required');
  return model.deleteContactMessage(id);
};

module.exports = {
  getLandingPage,
  getAdminLandingPage,
  updateSection,
  createSection,
  resetSection,
  validateSectionData,
  invalidateCache,
  createContactMessage,
  getContactMessages,
  getApprovedFeedbacks,
  updateContactMessageStatus,
  markContactMessageAsRead,
  deleteContactMessage
};
