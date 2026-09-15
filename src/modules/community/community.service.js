const repository = require('./community.repository');
const prisma = require('../../config/database');

// Helper to format sender name based on anonymity
const formatSenderName = (user, isAnonymous) => {
  if (isAnonymous) {
    return 'Anonymous Sakhi';
  }
  return user?.profile?.fullName || 'health sakhi r';
};

// ── Circles (Groups) Services ──
const getCircles = async (userId) => {
  const allCircles = await repository.getCircles();
  const joinedCircles = await repository.getMemberCircles(userId);
  const joinedIds = new Set(joinedCircles.map(c => c.circleId));

  return allCircles.map(circle => ({
    id: circle.id,
    name: circle.name,
    description: circle.description,
    icon: circle.icon,
    color: circle.color,
    joined: joinedIds.has(circle.id)
  }));
};

const joinCircle = async (circleId, userId) => {
  const existing = await repository.getCircleMember(circleId, userId);
  if (existing) {
    if (existing.isBlocked) {
      throw new Error('You have been restricted from this circle by Admin.');
    }
    return { success: true, message: 'Already joined circle' };
  }
  await repository.joinCircle(circleId, userId);
  return { success: true, message: 'Successfully joined circle' };
};

const leaveCircle = async (circleId, userId) => {
  const existing = await repository.getCircleMember(circleId, userId);
  if (!existing) {
    return { success: true, message: 'Not a member of this circle' };
  }
  await repository.leaveCircle(circleId, userId);
  return { success: true, message: 'Successfully left circle' };
};

// ── Circle Chat Services ──
const getCircleMessages = async (circleId, userId) => {
  // Verify membership
  const isMember = await repository.getCircleMember(circleId, userId);
  if (!isMember) {
    throw new Error('You must join this circle to view the chat');
  }
  if (isMember.isBlocked) {
    throw new Error('You have been restricted from this circle by Admin.');
  }

  const messages = await repository.getCircleMessages(circleId);
  return messages.map(msg => ({
    id: msg.id,
    message: msg.message,
    isAnonymous: msg.isAnonymous,
    senderName: formatSenderName(msg.user, msg.isAnonymous),
    isOwnMessage: msg.userId === userId,
    createdAt: msg.createdAt
  }));
};

const sendCircleMessage = async (circleId, userId, message, isAnonymous) => {
  // Verify membership
  const isMember = await repository.getCircleMember(circleId, userId);
  if (!isMember) {
    throw new Error('You must join this circle to send messages');
  }
  if (isMember.isBlocked) {
    throw new Error('You have been restricted from this circle by Admin.');
  }

  if (!message || message.trim() === '') {
    throw new Error('Message cannot be empty');
  }

  const msg = await repository.createCircleMessage(circleId, userId, message, isAnonymous);

  // Send notifications to other members of the circle
  try {
    const circle = await repository.getCircleById(circleId);
    if (circle) {
      const otherMembers = await prisma.communityCircleMember.findMany({
        where: { circleId, NOT: { userId } }
      });
      const senderProfile = await prisma.userProfile.findUnique({
        where: { userId }
      });
      const senderName = isAnonymous ? 'Anonymous' : (senderProfile?.fullName || 'Sakhi');
      const notificationsService = require('../notifications/notifications.service');

      for (const m of otherMembers) {
        await notificationsService.sendPushNotification(
          m.userId,
          `New message in ${circle.name}`,
          `${senderName}: ${message.substring(0, 60)}${message.length > 60 ? '...' : ''}`,
          'circle'
        );
      }
    }
  } catch (err) {
    console.error('Failed to send circle message notification:', err);
  }

  return {
    id: msg.id,
    message: msg.message,
    isAnonymous: msg.isAnonymous,
    senderName: formatSenderName(msg.user, msg.isAnonymous),
    isOwnMessage: true,
    createdAt: msg.createdAt
  };
};

// ── Forum Posts Services ──
const getPosts = async (currentUserId) => {
  const posts = await repository.getPosts();
  return posts.map(post => ({
    id: post.id,
    title: post.title,
    tag: post.tag,
    content: post.content,
    replies: post._count.replies,
    author: formatSenderName(post.user, post.isAnonymous),
    isUserPost: post.userId === currentUserId,
    createdAt: post.createdAt
  }));
};

const createPost = async (userId, title, tag, content, isAnonymous) => {
  if (!title || title.trim() === '') throw new Error('Title is required');
  if (!content || content.trim() === '') throw new Error('Content is required');
  if (!tag || tag.trim() === '') throw new Error('Tag is required');

  const post = await repository.createPost(userId, title, tag, content, isAnonymous);
  return {
    id: post.id,
    title: post.title,
    tag: post.tag,
    content: post.content,
    replies: post._count.replies,
    author: formatSenderName(post.user, post.isAnonymous),
    isUserPost: true,
    createdAt: post.createdAt
  };
};

const deletePost = async (postId, userId) => {
  const post = await repository.getPostById(postId);
  if (!post) {
    throw new Error('Post not found');
  }
  if (post.userId !== userId) {
    throw new Error('Unauthorized to delete this post');
  }
  await repository.deletePost(postId);
  return { success: true, message: 'Post successfully deleted' };
};

// ── Forum Post Replies Services ──
const getPostReplies = async (postId) => {
  const post = await repository.getPostById(postId);
  if (!post) {
    throw new Error('Post not found');
  }
  const replies = await repository.getPostReplies(postId);
  return replies.map(rep => ({
    id: rep.id,
    content: rep.content,
    senderName: formatSenderName(rep.user, rep.isAnonymous),
    createdAt: rep.createdAt
  }));
};

const createPostReply = async (postId, userId, content, isAnonymous) => {
  if (!content || content.trim() === '') throw new Error('Reply content is required');

  const post = await repository.getPostById(postId);
  if (!post) {
    throw new Error('Post not found');
  }

  const reply = await repository.createPostReply(postId, userId, content, isAnonymous);

  // Send notification to the post author
  if (post.userId && post.userId !== userId) {
    try {
      const senderProfile = await prisma.userProfile.findUnique({
        where: { userId }
      });
      const senderName = isAnonymous ? 'Anonymous' : (senderProfile?.fullName || 'Sakhi');
      const notificationsService = require('../notifications/notifications.service');
      await notificationsService.sendPushNotification(
        post.userId,
        `New reply on your post: "${post.title}"`,
        `${senderName}: ${content.substring(0, 60)}${content.length > 60 ? '...' : ''}`,
        'forum'
      );
    } catch (err) {
      console.error('Failed to send notification for post reply:', err);
    }
  }

  return {
    id: reply.id,
    content: reply.content,
    senderName: formatSenderName(reply.user, reply.isAnonymous),
    createdAt: reply.createdAt
  };
};

module.exports = {
  getCircles,
  joinCircle,
  leaveCircle,
  getCircleMessages,
  sendCircleMessage,
  getPosts,
  createPost,
  deletePost,
  getPostReplies,
  createPostReply
};
