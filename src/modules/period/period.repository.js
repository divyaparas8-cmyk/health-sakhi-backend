const prisma = require('../../config/database');

const createProfile = async (profileData) => {
  const { userId, ...rest } = profileData;
  return await prisma.periodProfile.create({
    data: {
      ...rest,
      user: {
        connect: { id: userId }
      }
    }
  });
};

const getProfileByUserId = async (userId) => {
  return await prisma.periodProfile.findUnique({
    where: { userId }
  });
};

const updateProfile = async (userId, updateData) => {
  return await prisma.periodProfile.update({
    where: { userId },
    data: updateData
  });
};

const createLog = async (logData) => {
  const { userId, ...rest } = logData;
  return await prisma.periodLog.create({
    data: {
      ...rest,
      user: {
        connect: { id: userId }
      }
    }
  });
};

const getLogsByUserId = async (userId, limit = 100, offset = 0) => {
  return await prisma.periodLog.findMany({
    where: { userId },
    orderBy: { logDate: 'desc' },
    take: limit,
    skip: offset
  });
};

module.exports = {
  createProfile,
  getProfileByUserId,
  updateProfile,
  createLog,
  getLogsByUserId
};
