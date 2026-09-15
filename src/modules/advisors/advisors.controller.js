const advisorsService = require('./advisors.service');
const multer = require('multer');
const imagekit = require('../../config/imagekit');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const uploadChatFileMiddleware = upload.single('chatFile');


const searchAdvisors = async (req, res, next) => {
  try {
    const result = await advisorsService.searchAdvisors(req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const result = await advisorsService.getAvailability(id, date);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createAvailability = async (req, res, next) => {
  try {
    const result = await advisorsService.createAvailability(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const bulkSaveAvailability = async (req, res, next) => {
  try {
    const result = await advisorsService.bulkSaveAvailability(req.user.id, req.body.slots);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const bookAppointment = async (req, res, next) => {
  try {
    const result = await advisorsService.bookAppointment(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getAppointments = async (req, res, next) => {
  try {
    const result = await advisorsService.getAppointments(req.user.id, req.user.role);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const submitNotes = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await advisorsService.submitNotes(req.user.id, id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getEarnings = async (req, res, next) => {
  try {
    const result = await advisorsService.getEarnings(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const requestPayout = async (req, res, next) => {
  try {
    const result = await advisorsService.requestPayout(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const rescheduleAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_availability_id } = req.body;
    const result = await advisorsService.rescheduleAppointment(id, new_availability_id, req.user.id, req.user.role);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await advisorsService.cancelAppointment(id, req.user.id, req.user.role);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const confirmAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;
    const result = await advisorsService.confirmAppointment(id, req.user.id, date, time);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getDashboardData = async (req, res, next) => {
  try {
    const result = await advisorsService.getDashboardData(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getMeAvailability = async (req, res, next) => {
  try {
    const result = await advisorsService.getMeAvailability(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getChatThreads = async (req, res, next) => {
  try {
    const result = await advisorsService.getChatThreads(req.user.id, req.user.role);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getChatMessages = async (req, res, next) => {
  try {
    const result = await advisorsService.getChatMessages(req.user.id, req.user.role, req.query.partnerId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const sendChatMessage = async (req, res, next) => {
  try {
    const result = await advisorsService.sendChatMessage(req.user.id, req.user.role, req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const uploadChatFile = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    
    // Upload buffer to ImageKit CDN inside /healthsakhi_chats folder
    const uploadRes = await imagekit.upload({
      file: req.file.buffer,
      fileName: `${Date.now()}-${req.file.originalname}`,
      folder: '/healthsakhi_chats'
    });

    // Fallback: If in mock mode (using dummy credentials), write buffer to local uploads folder
    if (uploadRes.url.includes('localhost:5000/uploads')) {
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadsDir, uploadRes.name), req.file.buffer);
    }

    res.status(200).json({
      success: true,
      url: uploadRes.url,
      name: req.file.originalname,
      mimeType: req.file.mimetype
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  searchAdvisors,
  getAvailability,
  createAvailability,
  bulkSaveAvailability,
  bookAppointment,
  getAppointments,
  submitNotes,
  getEarnings,
  requestPayout,
  rescheduleAppointment,
  cancelAppointment,
  confirmAppointment,
  getDashboardData,
  getMeAvailability,
  getChatThreads,
  getChatMessages,
  sendChatMessage,
  uploadChatFileMiddleware,
  uploadChatFile
};
