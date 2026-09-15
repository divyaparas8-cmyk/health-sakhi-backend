const aiSakhiService = require('./ai-sakhi.service');

const createSession = async (req, res, next) => {
  try {
    const { title } = req.body;
    const result = await aiSakhiService.createSession(req.user.id, title);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getSessions = async (req, res, next) => {
  try {
    const result = await aiSakhiService.getSessions(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { session_id } = req.params;
    const result = await aiSakhiService.getMessages(session_id, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const chat = async (req, res, next) => {
  try {
    const { session_id, message, mode } = req.body;
    const result = await aiSakhiService.sendMessage(req.user.id, session_id, message, mode);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSession,
  getSessions,
  getMessages,
  chat
};
