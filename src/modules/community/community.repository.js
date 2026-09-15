const prisma = require('../../config/database');

// ── Circles (Groups) Repository ──
const getCircles = async () => {
  return await prisma.communityCircle.findMany({
    orderBy: { name: 'asc' }
  });
};

const getCircleById = async (id) => {
  return await prisma.communityCircle.findUnique({
    where: { id }
  });
};

const getCircleMember = async (circleId, userId) => {
  return await prisma.communityCircleMember.findUnique({
    where: {
      circleId_userId: { circleId, userId }
    }
  });
};

const getMemberCircles = async (userId) => {
  return await prisma.communityCircleMember.findMany({
    where: { userId },
    select: { circleId: true }
  });
};

const joinCircle = async (circleId, userId) => {
  return await prisma.communityCircleMember.create({
    data: {
      circle: { connect: { id: circleId } },
      user: { connect: { id: userId } }
    }
  });
};

const leaveCircle = async (circleId, userId) => {
  return await prisma.communityCircleMember.delete({
    where: {
      circleId_userId: { circleId, userId }
    }
  });
};

// ── Chat Messages Repository ──
const getCircleMessages = async (circleId, limit = 50) => {
  return await prisma.communityCircleMessage.findMany({
    where: { circleId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      user: {
        include: {
          profile: {
            select: { fullName: true }
          }
        }
      }
    }
  });
};

const createCircleMessage = async (circleId, userId, message, isAnonymous) => {
  return await prisma.communityCircleMessage.create({
    data: {
      message,
      isAnonymous,
      circle: { connect: { id: circleId } },
      user: { connect: { id: userId } }
    },
    include: {
      user: {
        include: {
          profile: {
            select: { fullName: true }
          }
        }
      }
    }
  });
};

// ── Forum Posts (Trending Conversations) Repository ──
const getPosts = async () => {
  return await prisma.communityPost.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        include: {
          profile: {
            select: { fullName: true }
          }
        }
      },
      _count: {
        select: { replies: true }
      }
    }
  });
};

const getPostById = async (id) => {
  return await prisma.communityPost.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          profile: {
            select: { fullName: true }
          }
        }
      }
    }
  });
};

const createPost = async (userId, title, tag, content, isAnonymous) => {
  return await prisma.communityPost.create({
    data: {
      title,
      tag,
      content,
      isAnonymous,
      user: { connect: { id: userId } }
    },
    include: {
      user: {
        include: {
          profile: {
            select: { fullName: true }
          }
        }
      },
      _count: {
        select: { replies: true }
      }
    }
  });
};

const deletePost = async (id) => {
  return await prisma.communityPost.delete({
    where: { id }
  });
};

// ── Forum Post Replies Repository ──
const getPostReplies = async (postId) => {
  return await prisma.communityPostReply.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        include: {
          profile: {
            select: { fullName: true }
          }
        }
      }
    }
  });
};

const createPostReply = async (postId, userId, content, isAnonymous) => {
  return await prisma.communityPostReply.create({
    data: {
      content,
      isAnonymous,
      post: { connect: { id: postId } },
      user: { connect: { id: userId } }
    },
    include: {
      user: {
        include: {
          profile: {
            select: { fullName: true }
          }
        }
      }
    }
  });
};

module.exports = {
  getCircles,
  getCircleById,
  getCircleMember,
  getMemberCircles,
  joinCircle,
  leaveCircle,
  getCircleMessages,
  createCircleMessage,
  getPosts,
  getPostById,
  createPost,
  deletePost,
  getPostReplies,
  createPostReply
};
