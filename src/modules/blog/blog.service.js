const prisma = require('../../config/database');

const createBlog = async (data) => {
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    throw new Error('Title is required and must be a string');
  }
  return prisma.blog.create({
    data: {
      title: data.title.trim(),
      desc: data.desc ? data.desc.trim() : null,
      content: data.content ? data.content.trim() : null,
      category: data.category ? data.category.trim() : 'Wellness',
      tag: data.tag ? data.tag.trim() : 'Wellness',
      author: data.author ? data.author.trim() : 'Dr. Pratap',
      img: data.img ? data.img.trim() : null,
      pdfUrl: data.pdfUrl ? data.pdfUrl.trim() : null,
      date: data.date ? data.date.trim() : 'April 2026'
    }
  });
};

const getBlogs = async (filters = {}) => {
  const where = {};
  if (filters.category && filters.category !== 'All') {
    where.category = filters.category;
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { desc: { contains: filters.search } },
      { content: { contains: filters.search } }
    ];
  }
  return prisma.blog.findMany({
    where,
    include: {
      feedbacks: true
    },
    orderBy: { createdAt: 'desc' }
  });
};

const getBlogById = async (id) => {
  return prisma.blog.findUnique({
    where: { id },
    include: {
      feedbacks: true
    }
  });
};

const updateBlog = async (id, data) => {
  const updateData = {};
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.desc !== undefined) updateData.desc = data.desc ? data.desc.trim() : null;
  if (data.content !== undefined) updateData.content = data.content ? data.content.trim() : null;
  if (data.category !== undefined) updateData.category = data.category ? data.category.trim() : 'Wellness';
  if (data.tag !== undefined) updateData.tag = data.tag ? data.tag.trim() : 'Wellness';
  if (data.author !== undefined) updateData.author = data.author ? data.author.trim() : 'Dr. Pratap';
  if (data.img !== undefined) updateData.img = data.img ? data.img.trim() : null;
  if (data.pdfUrl !== undefined) updateData.pdfUrl = data.pdfUrl ? data.pdfUrl.trim() : null;
  if (data.date !== undefined) updateData.date = data.date ? data.date.trim() : 'April 2026';

  return prisma.blog.update({
    where: { id },
    data: updateData
  });
};

const deleteBlog = async (id) => {
  return prisma.blog.delete({
    where: { id }
  });
};

const createFeedback = async (blogId, data) => {
  if (!blogId) throw new Error('Blog ID is required');
  const rating = parseInt(data.rating, 10);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const blog = await prisma.blog.findUnique({
    where: { id: blogId },
    select: { title: true }
  });
  const blogTitle = blog ? blog.title : 'Unknown Blog';

  const feedback = await prisma.blogFeedback.create({
    data: {
      blogId,
      userName: data.userName ? data.userName.trim() : 'Wellness Sakhi',
      rating,
      comment: data.comment ? data.comment.trim() : null
    }
  });

  try {
    await prisma.contactMessage.create({
      data: {
        name: data.userName ? data.userName.trim() : 'Wellness Sakhi',
        email: 'reader@healthsakhi.com',
        message: data.comment ? data.comment.trim() : `Rated ${rating} stars`,
        type: 'feedback',
        role: `Blog Review: ${blogTitle}`,
        rating: rating,
        status: 'pending',
        read: false
      }
    });
  } catch (err) {
    console.error('Failed to create corresponding contact message for blog feedback:', err);
  }

  return feedback;
};

const getBlogFeedbacks = async (blogId) => {
  return prisma.blogFeedback.findMany({
    where: { blogId },
    orderBy: { createdAt: 'desc' }
  });
};

const deleteFeedback = async (feedbackId) => {
  return prisma.blogFeedback.delete({
    where: { id: feedbackId }
  });
};

module.exports = {
  createBlog,
  getBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  createFeedback,
  getBlogFeedbacks,
  deleteFeedback
};
