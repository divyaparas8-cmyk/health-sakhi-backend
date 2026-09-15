const blogService = require('./blog.service');

const getPublicBlogs = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const result = await blogService.getBlogs({ category, search });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getBlogById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await blogService.getBlogById(id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getBlogFeedbacks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await blogService.getBlogFeedbacks(id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const submitBlogFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await blogService.createFeedback(id, req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// Admin handlers
const getAdminBlogs = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const result = await blogService.getBlogs({ category, search });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const createBlog = async (req, res, next) => {
  try {
    const result = await blogService.createBlog(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const updateBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await blogService.updateBlog(id, req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const deleteBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    await blogService.deleteBlog(id);
    return res.status(200).json({ success: true, message: 'Blog deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const deleteBlogFeedback = async (req, res, next) => {
  try {
    const { feedbackId } = req.params;
    await blogService.deleteFeedback(feedbackId);
    return res.status(200).json({ success: true, message: 'Feedback deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicBlogs,
  getBlogById,
  getBlogFeedbacks,
  submitBlogFeedback,
  getAdminBlogs,
  createBlog,
  updateBlog,
  deleteBlog,
  deleteBlogFeedback
};
