const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllFaqs = async (filters = {}) => {
  const where = {};
  
  if (filters.category) {
    where.category = filters.category;
  }
  
  if (filters.status) {
    where.status = filters.status;
  }
  
  if (filters.isPopular !== undefined) {
    where.isPopular = filters.isPopular === 'true' || filters.isPopular === true;
  }

  if (filters.search) {
    where.OR = [
      { question: { contains: filters.search } },
      { answer: { contains: filters.search } }
    ];
  }

  return prisma.faq.findMany({
    where,
    orderBy: [
      { displayOrder: 'asc' },
      { createdAt: 'desc' }
    ]
  });
};

const getFaqById = async (id) => {
  return prisma.faq.findUnique({
    where: { id }
  });
};

const createFaq = async (data) => {
  const faq = await prisma.faq.create({
    data: {
      question: data.question,
      answer: data.answer,
      category: data.category,
      displayOrder: Number(data.displayOrder) || 0,
      status: data.status || 'Published',
      isPopular: data.isPopular === true || data.isPopular === 'true'
    }
  });

  try {
    const { notifyAllMembers } = require('../notifications/notifications.service');
    await notifyAllMembers(
      `New FAQ Added 🌸`,
      faq.question,
      'faq'
    );
  } catch (err) {
    console.error(`[FAQ Notification Error]`, err);
  }

  return faq;
};

const updateFaq = async (id, data) => {
  return prisma.faq.update({
    where: { id },
    data: {
      question: data.question !== undefined ? data.question : undefined,
      answer: data.answer !== undefined ? data.answer : undefined,
      category: data.category !== undefined ? data.category : undefined,
      displayOrder: data.displayOrder !== undefined ? (Number(data.displayOrder) || 0) : undefined,
      status: data.status !== undefined ? data.status : undefined,
      isPopular: data.isPopular !== undefined ? (data.isPopular === true || data.isPopular === 'true') : undefined
    }
  });
};

const deleteFaq = async (id) => {
  return prisma.faq.delete({
    where: { id }
  });
};

const submitFeedback = async (id, type) => {
  const isHelpful = type === 'helpful';
  return prisma.faq.update({
    where: { id },
    data: {
      helpfulCount: isHelpful ? { increment: 1 } : undefined,
      notHelpfulCount: !isHelpful ? { increment: 1 } : undefined
    }
  });
};

module.exports = {
  getAllFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  submitFeedback
};
