const prisma = require('../../config/database');

const getAllSections = async () => {
  return prisma.landingPageSection.findMany({
    orderBy: { sectionKey: 'asc' }
  });
};

const getActiveSections = async () => {
  return prisma.landingPageSection.findMany({
    where: { isActive: true }
  });
};

const getSectionByKey = async (key) => {
  return prisma.landingPageSection.findUnique({
    where: { sectionKey: key }
  });
};

const updateSectionByKey = async (key, data) => {
  return prisma.landingPageSection.upsert({
    where: { sectionKey: key },
    update: data,
    create: {
      sectionKey: key,
      ...data
    }
  });
};

const createSection = async (data) => {
  return prisma.landingPageSection.create({
    data
  });
};

const createContactMessage = async (data) => {
  return prisma.contactMessage.create({
    data
  });
};

const getContactMessages = async () => {
  return prisma.contactMessage.findMany({
    orderBy: { createdAt: 'desc' }
  });
};

const markContactMessageAsRead = async (id) => {
  return prisma.contactMessage.update({
    where: { id },
    data: { read: true }
  });
};

const deleteContactMessage = async (id) => {
  return prisma.contactMessage.delete({
    where: { id }
  });
};

const getApprovedFeedbacks = async () => {
  return prisma.contactMessage.findMany({
    where: {
      type: 'feedback',
      status: 'approved'
    },
    orderBy: { createdAt: 'desc' }
  });
};

const updateContactMessageStatus = async (id, status) => {
  return prisma.contactMessage.update({
    where: { id },
    data: { status, read: true }
  });
};

module.exports = {
  getAllSections,
  getActiveSections,
  getSectionByKey,
  updateSectionByKey,
  createSection,
  createContactMessage,
  getContactMessages,
  getApprovedFeedbacks,
  markContactMessageAsRead,
  updateContactMessageStatus,
  deleteContactMessage
};
