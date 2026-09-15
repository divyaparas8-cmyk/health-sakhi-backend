const express = require('express');
const controller = require('./blog.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');

const router = express.Router();

// Public / Member Endpoints
router.get('/public/blogs', controller.getPublicBlogs);
router.get('/public/blogs/:id', controller.getBlogById);
router.get('/public/blogs/:id/feedbacks', controller.getBlogFeedbacks);
router.post('/public/blogs/:id/feedbacks', controller.submitBlogFeedback);

// Admin-Only Endpoints
router.get('/admin/blogs', authenticate, authorize(['Admin', 'admin']), controller.getAdminBlogs);
router.post('/admin/blogs', authenticate, authorize(['Admin', 'admin']), controller.createBlog);
router.put('/admin/blogs/:id', authenticate, authorize(['Admin', 'admin']), controller.updateBlog);
router.delete('/admin/blogs/:id', authenticate, authorize(['Admin', 'admin']), controller.deleteBlog);
router.delete('/admin/blogs/feedbacks/:feedbackId', authenticate, authorize(['Admin', 'admin']), controller.deleteBlogFeedback);

module.exports = router;
