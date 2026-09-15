const contentService = require('./content.service');
const youtubeService = require('./youtube.service');

const listBooks = async (req, res, next) => {
  try {
    const { search } = req.query;
    const result = await contentService.listBooks(req.user.id, search);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await contentService.getBook(id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getChapter = async (req, res, next) => {
  try {
    const { bookId, chapterId } = req.params;
    const { lang } = req.query;
    const result = await contentService.getChapter(bookId, chapterId, lang);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const saveBookProgress = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const result = await contentService.saveBookProgress(req.user.id, bookId, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const listVideos = async (req, res, next) => {
  try {
    const { playlist } = req.query;
    const result = await contentService.listVideos(req.user.id, playlist);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const saveVideoProgress = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const result = await contentService.saveVideoProgress(req.user.id, videoId, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const listMeditations = async (req, res, next) => {
  try {
    const { category } = req.query;
    const result = await contentService.listMeditations(category);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const listAffirmations = async (req, res, next) => {
  try {
    const { category, mood } = req.query;
    const result = await contentService.listAffirmations(category, mood);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const listSakhiContent = async (req, res, next) => {
  try {
    const result = await contentService.listSakhiContent(req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// ─── YOUTUBE MEDITATION VIDEOS ───────────────────────────────────────────────

const listYoutubeVideos = async (req, res, next) => {
  try {
    const { keyword, videoType, page = 1, limit = 20, random } = req.query;
    const result = await youtubeService.listYoutubeVideos({
      keyword,
      videoType,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      random: random === undefined ? true : random === 'true',
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listBooks,
  getBook,
  getChapter,
  saveBookProgress,
  listVideos,
  saveVideoProgress,
  listMeditations,
  listAffirmations,
  listSakhiContent,
  listYoutubeVideos,
};

