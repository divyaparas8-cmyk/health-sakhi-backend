const service = require('./community.service');

const getCircles = async (req, res, next) => {
  try {
    const circles = await service.getCircles(req.user.id);
    res.status(200).json({
      success: true,
      circles
    });
  } catch (error) {
    next(error);
  }
};

const joinCircle = async (req, res, next) => {
  try {
    const { circleId } = req.params;
    const result = await service.joinCircle(circleId, req.user.id);
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

const leaveCircle = async (req, res, next) => {
  try {
    const { circleId } = req.params;
    const result = await service.leaveCircle(circleId, req.user.id);
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

const getCircleMessages = async (req, res, next) => {
  try {
    const { circleId } = req.params;
    const messages = await service.getCircleMessages(circleId, req.user.id);
    res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    next(error);
  }
};

const sendCircleMessage = async (req, res, next) => {
  try {
    const { circleId } = req.params;
    const { message, isAnonymous } = req.body;
    const result = await service.sendCircleMessage(circleId, req.user.id, message, isAnonymous);
    res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      chatMessage: result
    });
  } catch (error) {
    next(error);
  }
};

const getPosts = async (req, res, next) => {
  try {
    const posts = await service.getPosts(req.user.id);
    res.status(200).json({
      success: true,
      posts
    });
  } catch (error) {
    next(error);
  }
};

const createPost = async (req, res, next) => {
  try {
    const { title, tag, content, anonymous } = req.body;
    const post = await service.createPost(req.user.id, title, tag, content, anonymous);
    res.status(201).json({
      success: true,
      message: 'Post created successfully.',
      post
    });
  } catch (error) {
    next(error);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await service.deletePost(id, req.user.id);
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

const getPostReplies = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const replies = await service.getPostReplies(postId);
    res.status(200).json({
      success: true,
      replies
    });
  } catch (error) {
    next(error);
  }
};

const createPostReply = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { content, anonymous } = req.body;
    const reply = await service.createPostReply(postId, req.user.id, content, anonymous);
    res.status(201).json({
      success: true,
      message: 'Reply added successfully.',
      reply
    });
  } catch (error) {
    next(error);
  }
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
