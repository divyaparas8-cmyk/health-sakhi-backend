const express = require('express');
const controller = require('./community.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');

const router = express.Router();

// Enforce auth & member role restrictions on all endpoints
router.use(authenticate);
router.use(authorize(['Member', 'member']));

// Circle / Group Endpoints
router.get('/circles', controller.getCircles);
router.post('/circles/:circleId/join', controller.joinCircle);
router.post('/circles/:circleId/leave', controller.leaveCircle);

// Circle Chat Room Endpoints
router.get('/circles/:circleId/messages', controller.getCircleMessages);
router.post('/circles/:circleId/messages', controller.sendCircleMessage);

// Forum Post Endpoints (Trending Conversations)
router.get('/posts', controller.getPosts);
router.post('/posts', controller.createPost);
router.delete('/posts/:id', controller.deletePost);

// Forum Post Reply Endpoints
router.get('/posts/:postId/replies', controller.getPostReplies);
router.post('/posts/:postId/replies', controller.createPostReply);

module.exports = router;
